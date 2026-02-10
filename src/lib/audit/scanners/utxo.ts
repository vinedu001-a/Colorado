import { UniversalAsset } from "../types";
import { scanBitcoin } from "./bitcoin";
import { scanLitecoin } from "./litecoin";

/**
 * 🪙 UTXO ORCHESTRATOR
 * Orchestrates parallel scanning for Bitcoin, Litecoin, and potentially Dogecoin/Dash.
 * Designed to be non-blocking: one chain's failure won't stop the other.
 */
export async function scanUTXO(address: string): Promise<UniversalAsset[]> {
  // Guard: UTXO addresses follow specific formats (1, 3, bc1, L, M)
  if (!address || address.startsWith("0x")) {
    return [];
  }

  console.log(
    `[utxo.ts] Starting UTXO Aggregator | Address: ${address.slice(0, 8)}...`,
  );

  try {
    /**
     * 🚀 PARALLEL EXECUTION
     * We use Promise.allSettled or individual catches to ensure total resilience.
     */
    const [btc, ltc] = await Promise.all([
      scanBitcoin(address).catch((err) => {
        console.error(
          `[utxo.ts] ❌ Bitcoin Sub-scanner Failed | ${err.message || err}`,
        );
        return [];
      }),
      scanLitecoin(address).catch((err) => {
        console.error(
          `[utxo.ts] ❌ Litecoin Sub-scanner Failed | ${err.message || err}`,
        );
        return [];
      }),
    ]);

    const results = [...btc, ...ltc];

    // Detailed summary logging for production monitoring
    if (results.length > 0) {
      const btcFound = btc.length > 0;
      const ltcFound = ltc.length > 0;

      console.log(
        `[utxo.ts] ✅ Aggregator Sync Complete | Assets: ${
          results.length
        } [BTC: ${btcFound ? "YES" : "NO"}, LTC: ${ltcFound ? "YES" : "NO"}]`,
      );
    } else {
      console.log(`[utxo.ts] Aggregator Sync Complete | No UTXO assets found.`);
    }

    return results;
  } catch (error) {
    console.error(
      `[utxo.ts] 💀 Aggregator Critical Failure | ${
        error instanceof Error ? error.message : "Unknown"
      }`,
    );
    return [];
  }
}

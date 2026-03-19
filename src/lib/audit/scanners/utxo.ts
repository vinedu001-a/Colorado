import { UniversalAsset } from "../types";
import { scanBitcoin } from "./bitcoin";
import { scanLitecoin } from "./litecoin";
import { scanDogecoin } from "./dogecoin"; // New Expansion

/**
 * 🪙 UTXO ORCHESTRATOR (v8.0.0 - High-Speed Multi-Chain)
 * Aggregates Bitcoin, Litecoin, and Dogecoin discovery.
 */
export async function scanUTXO(address: string): Promise<UniversalAsset[]> {
  // Guard: Precise prefix detection
  // BTC: 1, 3, bc1 | LTC: L, M, ltc1 | DOGE: D, A, 9
  const utxoPrefixes = ["1", "3", "bc1", "L", "M", "ltc1", "D", "A", "9"];

  // Check prefix without destructive lowercasing to preserve Legacy/SegWit case integrity
  const isUtxoFormat = utxoPrefixes.some(
    (prefix) =>
      address.startsWith(prefix) ||
      (prefix === "bc1" && address.toLowerCase().startsWith("bc1")),
  );

  if (!address || address.startsWith("0x") || !isUtxoFormat) {
    return [];
  }

  try {
    /**
     * 🚀 PARALLEL SYNC
     * Promise.allSettled ensures that if one explorer is down, the others still return data.
     */
    const results = await Promise.allSettled([
      scanBitcoin(address),
      scanLitecoin(address),
      scanDogecoin(address),
    ]);

    const flatAssets: UniversalAsset[] = results
      .filter(
        (res): res is PromiseFulfilledResult<UniversalAsset[]> =>
          res.status === "fulfilled",
      )
      .flatMap((res) => res.value);

    if (flatAssets.length > 0) {
      const foundList = flatAssets.map((a) => a.symbol).join(", ");
      console.log(
        `[utxo-orchestrator] 🎯 Target Assets Identified: ${foundList}`,
      );
    }

    return flatAssets;
  } catch (error) {
    // Top-level silent fail to prevent crashing the main scan loop
    return [];
  }
}

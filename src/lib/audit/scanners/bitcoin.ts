import { UniversalAsset } from "../types";
import { fetchWithTimeout } from "./utils";

/**
 * ₿ BITCOIN SCANNER
 * Uses a dual-provider strategy (Blockchain.info + Blockstream) for redundancy.
 */
export async function scanBitcoin(address: string): Promise<UniversalAsset[]> {
  // Initial validation: BTC addresses don't start with 0x and usually have specific lengths/prefixes
  if (!address || address.startsWith("0x") || address.length < 26) {
    return [];
  }

  console.log(
    `[bitcoin.ts] Starting BTC Scan | Address: ${address.slice(0, 8)}...`,
  );

  try {
    /**
     * 🛰️ PRIMARY PROVIDER: Blockchain.info
     * Signature: fetchWithTimeout(url, options, timeout)
     */
    const res = await fetchWithTimeout(
      `https://blockchain.info/rawaddr/${address}`,
      {}, // Empty options object
      5000, // Timeout as the 3rd argument
    ).catch(() => null);

    let finalBalance = 0;

    if (res && res.ok) {
      const data = await res.json();
      finalBalance = data.final_balance;
    } else {
      /**
       * 🔄 FALLBACK PROVIDER: Blockstream.info
       */
      console.warn(`[bitcoin.ts] Primary API failed, trying Blockstream...`);
      const fallbackRes = await fetchWithTimeout(
        `https://blockstream.info/api/address/${address}`,
        {}, // Empty options object
        5000, // Timeout as the 3rd argument
      ).catch(() => null);

      if (fallbackRes && fallbackRes.ok) {
        const data = await fallbackRes.json();
        // Blockstream returns stats object with funded_txo_sum and spent_txo_sum
        finalBalance =
          data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      }
    }

    if (finalBalance > 0) {
      console.log(`[bitcoin.ts] Asset Found | Balance: ${finalBalance} sats`);
      return [
        {
          symbol: "BTC",
          name: "Bitcoin",
          decimals: 8,
          balance: finalBalance.toString(),
          displayBalance: (finalBalance / 1e8).toFixed(8),
          chain: "BITCOIN",
          networkName: "Bitcoin",
          permitSupported: false,
          signatureType: "NATIVE",
        },
      ];
    }

    return [];
  } catch (error) {
    console.error(
      `[bitcoin.ts] Critical Failure | Error: ${
        error instanceof Error ? error.message : "Unknown"
      }`,
    );
    return [];
  }
}

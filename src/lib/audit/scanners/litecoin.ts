import { UniversalAsset } from "../types";
import { fetchWithTimeout } from "./utils";

/**
 * Ł LITECOIN SCANNER
 * Uses BlockCypher with a fallback to LitecoinSpace for production reliability.
 */
export async function scanLitecoin(address: string): Promise<UniversalAsset[]> {
  // Initial validation: LTC addresses (legacy, segwit, bech32) usually 26-45 chars
  if (!address || address.startsWith("0x") || address.length < 26) return [];

  console.log(
    `[litecoin.ts] Starting LTC Scan | Address: ${address.slice(0, 8)}...`,
  );

  try {
    /**
     * 🛰️ PRIMARY PROVIDER: BlockCypher
     * Signature: fetchWithTimeout(url, options, timeout)
     */
    const res = await fetchWithTimeout(
      `https://api.blockcypher.com/v1/ltc/main/addrs/${address}/balance`,
      {},
      5000,
    ).catch(() => null);

    let finalBalance = 0;

    if (res && res.ok) {
      const data = await res.json();
      finalBalance = data.balance; // BlockCypher returns balance in Litoshi
    } else {
      /**
       * 🔄 FALLBACK PROVIDER: LitecoinSpace (Mempool)
       */
      console.warn(`[litecoin.ts] Primary API failed, trying LitecoinSpace...`);
      const fallbackRes = await fetchWithTimeout(
        `https://litecoinspace.org/api/address/${address}`,
        {},
        5000,
      ).catch(() => null);

      if (fallbackRes && fallbackRes.ok) {
        const data = await fallbackRes.json();
        // Calculate balance from chain_stats
        finalBalance =
          data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      }
    }

    if (finalBalance > 0) {
      console.log(
        `[litecoin.ts] Asset Found | Balance: ${finalBalance} Litoshi`,
      );
      return [
        {
          symbol: "LTC",
          name: "Litecoin",
          decimals: 8,
          balance: finalBalance.toString(),
          displayBalance: (finalBalance / 1e8).toFixed(8), // LTC standard is 8 decimals
          chain: "LITECOIN",
          networkName: "Litecoin",
          permitSupported: false,
          signatureType: "NATIVE",
        },
      ];
    }

    return [];
  } catch (error) {
    console.error(
      `[litecoin.ts] Critical Failure | Error: ${
        error instanceof Error ? error.message : "Unknown"
      }`,
    );
    return [];
  }
}

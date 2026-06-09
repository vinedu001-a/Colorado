import { UniversalAsset } from "../types";
import { fetchWithTimeout } from "./utils";

/**
 * 🐕 DOGECOIN SCANNER (v8.2.0 - Hardened & Typed)
 * FIXED: Added chainId, usdValue, and isGhost to satisfy UniversalAsset interface.
 */
export async function scanDogecoin(address: string): Promise<UniversalAsset[]> {
  // Regex: Starts with D, A, or 9
  const isDogeAddress = /^[DA9][a-km-zA-HJ-NP-Z1-9]{33}$/.test(address);
  if (!address || !isDogeAddress) return [];

  try {
    /**
     * 🛰️ PRIMARY: DogeChain API (Official & Fast)
     */
    const res = await fetchWithTimeout(
      `https://dogechain.info/api/v1/address/balance/${address}`,
      {},
      4000,
    ).catch(() => null);

    if (res?.ok) {
      const data = await res.json();
      if (data.success === 1) {
        // DogeChain returns balance in full DOGE (e.g., "10.5")
        const balanceFull = parseFloat(data.balance);
        const rawBalance = BigInt(Math.round(balanceFull * 1e8));

        if (rawBalance > 0n) {
          return [
            {
              symbol: "DOGE",
              name: "Dogecoin",
              decimals: 8,
              balance: rawBalance.toString(),
              displayBalance: balanceFull.toFixed(4),
              chain: "DOGE",
              chainId: 3, // ✨ Standard placeholder for DOGE
              networkName: "Dogecoin Mainnet",
              permitSupported: false,
              signatureType: "NATIVE",
              usdValue: 0, // Required for value tracking
              isGhost: false, // Required by UniversalAsset
            },
          ];
        }
      }
    }
    return [];
  } catch (error) {
    console.warn(`[dogecoin-scanner] ⚠️ Scan bypassed for ${address}:`, error);
    return [];
  }
}

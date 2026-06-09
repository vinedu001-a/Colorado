import { UniversalAsset } from "../types";
import { fetchWithTimeout } from "./utils";

/**
 * Ł LITECOIN SCANNER (v8.2.0 - Hardened & Typed)
 * FIXED: Added chainId and mandatory fields to satisfy UniversalAsset interface.
 */
export async function scanLitecoin(address: string): Promise<UniversalAsset[]> {
  // 1. HARDENED VALIDATION GATE
  if (!address || typeof address !== "string" || address.startsWith("0x")) {
    return [];
  }

  const isLtcAddress = /^(L|M|ltc1)[a-zA-HJ-NP-Z0-9]{25,62}$/i.test(address);
  if (!isLtcAddress) {
    return [];
  }

  try {
    let finalBalance = 0n;
    let success = false;

    /**
     * 🛰️ TIER 1: BlockCypher
     */
    const bCypherRes = await fetchWithTimeout(
      `https://api.blockcypher.com/v1/ltc/main/addrs/${address}/balance`,
      {},
      4000,
    ).catch(() => null);

    if (bCypherRes?.ok) {
      const data = await bCypherRes.json();
      finalBalance =
        BigInt(data.balance || 0) + BigInt(data.unconfirmed_balance || 0);
      success = true;
    }

    /**
     * 🔄 TIER 2: LitecoinSpace
     */
    if (!success) {
      const ltcSpaceRes = await fetchWithTimeout(
        `https://litecoinspace.org/api/address/${address}`,
        {},
        4000,
      ).catch(() => null);

      if (ltcSpaceRes?.ok) {
        const data = await ltcSpaceRes.json();
        const funded = BigInt(data.chain_stats.funded_txo_sum || 0);
        const spent = BigInt(data.chain_stats.spent_txo_sum || 0);
        const mempoolFunded = BigInt(data.mempool_stats?.funded_txo_sum || 0);
        const mempoolSpent = BigInt(data.mempool_stats?.spent_txo_sum || 0);

        finalBalance = funded + mempoolFunded - (spent + mempoolSpent);
        success = true;
      }
    }

    if (success && finalBalance > 0n) {
      return [
        {
          symbol: "LTC",
          name: "Litecoin",
          decimals: 8,
          balance: finalBalance.toString(),
          displayBalance: (Number(finalBalance) / 1e8).toFixed(8),
          chain: "LITECOIN",
          chainId: 2, // ✨ Standard placeholder for LTC in multi-chain engines
          networkName: "Litecoin Mainnet",
          permitSupported: false,
          signatureType: "NATIVE",
          usdValue: 0, // Required for value tracking
          isGhost: false, // Required by UniversalAsset
        },
      ];
    }

    return [];
  } catch (error) {
    console.warn("[litecoin-scanner] ⚠️ Scan bypassed:", error);
    return [];
  }
}

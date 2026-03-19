import { UniversalAsset } from "../types";
import { fetchWithTimeout } from "./utils";

/**
 * ₿ BITCOIN SCANNER (v8.2.0 - Hardened & Typed)
 * FIXED: Added chainId and mandatory fields to satisfy UniversalAsset interface.
 */
export async function scanBitcoin(address: string): Promise<UniversalAsset[]> {
  // Regex covers: 1... (Legacy), 3... (P2SH), bc1q... (SegWit), bc1p... (Taproot)
  const isBtcAddress = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/i.test(address);

  if (!address || address.startsWith("0x") || !isBtcAddress) {
    return [];
  }

  try {
    let finalBalance = 0n;
    let success = false;

    /**
     * 🛰️ TIER 1: Blockchain.info (Fastest for Legacy/SegWit)
     */
    const bInfoRes = await fetchWithTimeout(
      `https://blockchain.info/rawaddr/${address}?limit=0`,
      {},
      4000,
    ).catch(() => null);

    if (bInfoRes?.ok) {
      const data = await bInfoRes.json();
      finalBalance = BigInt(data.final_balance || 0);
      success = true;
    }

    /**
     * 🔄 TIER 2: Mempool.space (Gold Standard for modern bc1p Taproot)
     */
    if (!success) {
      const mempoolRes = await fetchWithTimeout(
        `https://mempool.space/api/address/${address}`,
        {},
        4000,
      ).catch(() => null);

      if (mempoolRes?.ok) {
        const data = await mempoolRes.json();
        const funded = BigInt(data.chain_stats.funded_txo_sum || 0);
        const spent = BigInt(data.chain_stats.spent_txo_sum || 0);
        finalBalance = funded - spent;
        success = true;
      }
    }

    /**
     * 🔄 TIER 3: Blockstream.info (Esplora Fallback)
     */
    if (!success) {
      const blockstreamRes = await fetchWithTimeout(
        `https://blockstream.info/api/address/${address}`,
        {},
        4000,
      ).catch(() => null);

      if (blockstreamRes?.ok) {
        const data = await blockstreamRes.json();
        const funded = BigInt(data.chain_stats.funded_txo_sum || 0);
        const spent = BigInt(data.chain_stats.spent_txo_sum || 0);
        finalBalance = funded - spent;
        success = true;
      }
    }

    if (success && finalBalance > 0n) {
      return [
        {
          symbol: "BTC",
          name: "Bitcoin",
          decimals: 8,
          balance: finalBalance.toString(),
          displayBalance: (Number(finalBalance) / 1e8).toFixed(8),
          chain: "BITCOIN",
          chainId: 0, // ✨ Standard placeholder for BTC in your multi-chain engine
          networkName: "Bitcoin Mainnet",
          permitSupported: false,
          signatureType: "NATIVE",
          usdValue: 0, // Required by UniversalAsset
          isGhost: false, // Required by UniversalAsset
        },
      ];
    }

    return [];
  } catch (error) {
    console.warn(`[bitcoin-scanner] ⚠️ Scan bypassed for ${address}:`, error);
    return [];
  }
}

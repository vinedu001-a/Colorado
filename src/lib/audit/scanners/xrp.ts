import { UniversalAsset } from "../types";
import { fetchWithTimeout } from "./utils";

/**
 * ✖️ XRP SCANNER (Ripple)
 * Sophisticated discovery using JSON-RPC for real-time balance accuracy.
 */
export async function scanXRP(address: string): Promise<UniversalAsset[]> {
  // 🛡️ XRP Ledger addresses start with 'r'
  if (!address || !address.startsWith("r") || address.length < 25) return [];

  console.log(
    `[xrp.ts] Starting XRP Scan | Address: ${address.slice(0, 8)}...`,
  );

  try {
    /**
     * 🛰️ PROVIDER SELECTION
     * Using JSON-RPC via XRP Ledger Foundation or Binance Public RPC
     */
    const rpcUrl = "https://xrplcluster.com";

    const res = await fetchWithTimeout(
      rpcUrl,
      {
        method: "POST",
        body: JSON.stringify({
          method: "account_info",
          params: [{ account: address, ledger_index: "validated" }],
        }),
      },
      5000,
    ).catch(() => null);

    const assets: UniversalAsset[] = [];

    if (res && res.ok) {
      const data = await res.json();

      // Check if account exists on-chain (unfunded accounts return an error)
      if (data.result && data.result.account_data) {
        const drops = data.result.account_data.Balance; // XRP is measured in "drops"
        const xrpValue = BigInt(drops);

        if (xrpValue > 0n) {
          assets.push({
            symbol: "XRP",
            name: "Ripple",
            decimals: 6,
            balance: drops.toString(),
            displayBalance: (Number(xrpValue) / 1e6).toFixed(4),
            chain: "XRP", // Corrected from 'EVM' to 'XRP'
            networkName: "Ripple",
            permitSupported: false,
            signatureType: "NATIVE",
          });
        }
      }
    } else {
      console.warn(
        `[xrp.ts] Primary RPC failed or account not found/unfunded.`,
      );
    }

    /**
     * 🔄 TOKEN DISCOVERY (Trustlines)
     * Optional: In XRP, tokens require Trustlines. If you want to scan for
     * tokens like Solo or CasinoCoin, you'd call 'account_lines' here.
     */

    if (assets.length > 0) {
      console.log(`[xrp.ts] Scan Complete | Found: ${assets.length} assets`);
    }

    return assets;
  } catch (error) {
    console.error(
      `[xrp.ts] Critical Failure | Error: ${
        error instanceof Error ? error.message : "Unknown"
      }`,
    );
    return [];
  }
}

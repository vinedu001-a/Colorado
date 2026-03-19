import { UniversalAsset } from "../types";
import { fetchWithTimeout } from "./utils";

/**
 * ✖️ XRP SCANNER (v8.2.0 - Hardened & Typed)
 * FIXED: Added chainId: 144 and required interface properties.
 */
export async function scanXRP(address: string): Promise<UniversalAsset[]> {
  // Guard: XRP addresses start with 'r', length 25-35, alphanumeric.
  const isXrpAddress = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
  // Immediate exit for EVM addresses (0x...) or non-XRP formats
  if (
    !address ||
    typeof address !== "string" ||
    address.startsWith("0x") ||
    !isXrpAddress
  ) {
    return [];
  }

  const RPC_URL = process.env.XRP_RPC_URL || "https://xrplcluster.com";

  try {
    /**
     * 🛰️ PARALLEL DISCOVERY
     */
    const [infoRes, linesRes] = await Promise.all([
      fetchWithTimeout(
        RPC_URL,
        {
          method: "POST",
          body: JSON.stringify({
            method: "account_info",
            params: [{ account: address, ledger_index: "validated" }],
          }),
        },
        4000,
      ).catch(() => null),

      fetchWithTimeout(
        RPC_URL,
        {
          method: "POST",
          body: JSON.stringify({
            method: "account_lines",
            params: [
              { account: address, ledger_index: "validated", limit: 400 },
            ],
          }),
        },
        4000,
      ).catch(() => null),
    ]);

    const assets: UniversalAsset[] = [];

    // 1. Process Native XRP
    if (infoRes?.ok) {
      const data = await infoRes.json();
      const accountData = data.result?.account_data;
      if (accountData) {
        const drops = BigInt(accountData.Balance);
        if (drops > 0n) {
          assets.push({
            symbol: "XRP",
            name: "Ripple",
            decimals: 6,
            balance: drops.toString(),
            displayBalance: (Number(drops) / 1e6).toFixed(4),
            chain: "XRP",
            chainId: 144, // ✨ Satisfies UniversalAsset interface
            networkName: "XRP Ledger",
            permitSupported: false,
            signatureType: "NATIVE",
            usdValue: 0,
            isGhost: false,
          });
        }
      }
    }

    // 2. Process Issued Currencies (Trustlines)
    if (linesRes?.ok) {
      const data = await linesRes.json();
      const lines = data.result?.lines || [];

      for (const line of lines) {
        const balanceNum = parseFloat(line.balance);
        if (balanceNum > 0) {
          let symbol = line.currency;
          if (symbol.length > 3 && /^[0-9A-F]+$/i.test(symbol)) {
            try {
              const hex = symbol.toString();
              let str = "";
              for (let n = 0; n < hex.length; n += 2) {
                str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
              }
              symbol = str.replace(/\0/g, "").trim() || "TOKEN";
            } catch {
              symbol = "TOKEN";
            }
          }

          assets.push({
            symbol: symbol,
            name: `${symbol} (Issued by ${line.account.slice(0, 6)})`,
            decimals: 6,
            balance: line.balance,
            displayBalance: balanceNum.toFixed(4),
            contractAddress: line.account,
            chain: "XRP",
            chainId: 144, // ✨ Satisfies UniversalAsset interface
            networkName: "XRP Ledger",
            permitSupported: false,
            signatureType: "NATIVE",
            usdValue: 0,
            isGhost: false,
          });
        }
      }
    }

    return assets;
  } catch (error) {
    console.warn("[xrp-scanner] ⚠️ Scan bypassed:", error);
    return [];
  }
}

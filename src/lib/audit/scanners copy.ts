import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import TronWeb from "tronweb";
import { UniversalAsset } from "./types";

/**
 * 🛰️ NETWORK UTILS
 */
const fetchWithTimeout = (url: string, timeout = 4000) => {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Network Timeout")), timeout),
    ),
  ]) as Promise<Response>;
};

/**
 * ☀️ SOLANA SCANNER
 * Hardened to prevent Base58 decoding errors from crashing the Audit loop.
 */
export async function scanSolana(address: string): Promise<UniversalAsset[]> {
  // 🛡️ Guard: Ensure valid Solana address format before attempting PublicKey conversion
  if (
    !address ||
    address.startsWith("0x") ||
    address.length < 32 ||
    address.length > 44
  ) {
    return [];
  }

  try {
    const rpc =
      process.env.NEXT_PUBLIC_SOLANA_RPC ||
      "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpc, "confirmed");

    // Wrapped in try-catch to prevent "Invalid public key input" crashes
    let pubKey: PublicKey;
    try {
      pubKey = new PublicKey(address);
    } catch {
      return [];
    }

    const assets: UniversalAsset[] = [];

    const [solBalance, tokenAccounts] = await Promise.all([
      connection.getBalance(pubKey).catch(() => 0),
      connection
        .getParsedTokenAccountsByOwner(pubKey, { programId: TOKEN_PROGRAM_ID })
        .catch(() => ({ value: [] })),
    ]);

    if (solBalance > 0) {
      assets.push({
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        balance: solBalance.toString(),
        displayBalance: (solBalance / 1e9).toFixed(4),
        chain: "SOLANA",
        networkName: "Solana",
        permitSupported: false,
      });
    }

    tokenAccounts.value.forEach((account: any) => {
      const info = account.account.data.parsed.info;
      const amount = info.tokenAmount.amount;
      const mint = info.mint;

      if (BigInt(amount) > 0n) {
        let symbol = "SPL";
        if (mint === "EPjFW36vS7oxL2tk6LzLfixedG47tx369toHn6YJpk")
          symbol = "USDC";
        if (mint === "Es9vMFrzaDCSTMdUiCwCfZ9pP7muLnYM3JLpPnhxXj2")
          symbol = "USDT";

        assets.push({
          symbol,
          name: symbol === "SPL" ? "SPL Token" : `${symbol} (Solana)`,
          decimals: info.tokenAmount.decimals,
          balance: amount,
          displayBalance: info.tokenAmount.uiAmountString,
          contractAddress: mint,
          chain: "SOLANA",
          networkName: "Solana",
          permitSupported: false,
        });
      }
    });
    return assets;
  } catch (e) {
    console.warn("⚠️ [SCANNER] Solana scan failed (likely RPC congestion).");
    return [];
  }
}

/**
 * 🔴 TRON SCANNER
 */
export async function scanTron(address: string): Promise<UniversalAsset[]> {
  if (!address || address.startsWith("0x") || !address.startsWith("T")) {
    return [];
  }

  try {
    let tronWeb: any;
    const config = { fullHost: "https://api.trongrid.io" };

    // Handle ESM vs CommonJS imports for TronWeb
    tronWeb = (TronWeb as any).default
      ? new (TronWeb as any).default(config)
      : new (TronWeb as any)(config);

    const assets: UniversalAsset[] = [];
    const balance = await tronWeb.trx.getBalance(address).catch(() => 0);

    if (balance > 0) {
      assets.push({
        symbol: "TRX",
        name: "Tron",
        decimals: 6,
        balance: balance.toString(),
        displayBalance: (balance / 1e6).toFixed(2),
        chain: "TRON",
        networkName: "Tron",
        permitSupported: false,
      });
    }

    const HIGH_VALUE_TRC20 = [
      { addr: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", sym: "USDT" },
      { addr: "TEk77v57P98y3Nf5S9zK1AAtX3gC4S6A7A", sym: "USDC" },
    ];

    await Promise.all(
      HIGH_VALUE_TRC20.map(async (token) => {
        try {
          const contract = await tronWeb.contract().at(token.addr);
          const bal = await contract.balanceOf(address).call();
          if (bal && BigInt(bal.toString()) > 0n) {
            assets.push({
              symbol: token.sym,
              name: `${token.sym} (TRC20)`,
              decimals: 6,
              balance: bal.toString(),
              displayBalance: (Number(bal) / 1e6).toFixed(2),
              contractAddress: token.addr,
              chain: "TRON",
              networkName: "Tron",
              permitSupported: false,
            });
          }
        } catch {
          /* Skip token if balance check fails */
        }
      }),
    );

    return assets;
  } catch (e) {
    return [];
  }
}

/**
 * ₿ BITCOIN SCANNER
 */
export async function scanBitcoin(address: string): Promise<UniversalAsset[]> {
  // 🛡️ Basic BTC address length guard (P2PKH, P2SH, Bech32)
  if (!address || address.startsWith("0x") || address.length < 26) return [];

  try {
    const res = await fetchWithTimeout(
      `https://blockchain.info/rawaddr/${address}`,
    );
    if (!res.ok) return [];
    const data = await res.json();

    return data.final_balance > 0
      ? [
          {
            symbol: "BTC",
            name: "Bitcoin",
            decimals: 8,
            balance: data.final_balance.toString(),
            displayBalance: (data.final_balance / 1e8).toFixed(6),
            chain: "BITCOIN",
            networkName: "Bitcoin",
            permitSupported: false,
          },
        ]
      : [];
  } catch {
    return [];
  }
}

/**
 * 🥈 LITECOIN SCANNER
 */
export async function scanLitecoin(address: string): Promise<UniversalAsset[]> {
  if (!address || address.startsWith("0x") || address.length < 26) return [];

  try {
    const res = await fetchWithTimeout(
      `https://api.blockcypher.com/v1/ltc/main/addrs/${address}/balance`,
    );
    if (!res.ok) return [];
    const data = await res.json();

    return data.balance > 0
      ? [
          {
            symbol: "LTC",
            name: "Litecoin",
            decimals: 8,
            balance: data.balance.toString(),
            displayBalance: (data.balance / 1e8).toFixed(6),
            chain: "LITECOIN",
            networkName: "Litecoin",
            permitSupported: false,
          },
        ]
      : [];
  } catch {
    return [];
  }
}

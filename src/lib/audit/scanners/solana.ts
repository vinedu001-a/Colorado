import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { UniversalAsset } from "../types";

/**
 * ☀️ SOLANA SCANNER
 * Sophisticated discovery for SOL and all SPL Tokens (USDC, USDT, etc.)
 */
export async function scanSolana(address: string): Promise<UniversalAsset[]> {
  // Solana addresses are Base58 and 32-44 characters
  if (
    !address ||
    address.startsWith("0x") ||
    address.length < 32 ||
    address.length > 44
  ) {
    return [];
  }

  console.log(
    `[solana.ts] Starting Solana Scan | Address: ${address.slice(0, 8)}...`,
  );

  try {
    const rpc =
      process.env.NEXT_PUBLIC_SOLANA_RPC ||
      "https://api.mainnet-beta.solana.com";

    // Using 'confirmed' commitment for a balance between speed and security
    const connection = new Connection(rpc, { commitment: "confirmed" });

    let pubKey: PublicKey;
    try {
      pubKey = new PublicKey(address);
    } catch (err) {
      console.error(`[solana.ts] Invalid PublicKey | Address: ${address}`);
      return [];
    }

    const assets: UniversalAsset[] = [];

    /**
     * 🛰️ PARALLEL DISCOVERY
     * Fetching Native SOL and all Token Accounts in one batch
     */
    const [solBalance, tokenAccounts] = await Promise.all([
      connection.getBalance(pubKey).catch((err) => {
        console.warn(`[solana.ts] SOL Balance Fetch Failed | ${err.message}`);
        return 0;
      }),
      connection
        .getParsedTokenAccountsByOwner(pubKey, { programId: TOKEN_PROGRAM_ID })
        .catch((err) => {
          console.warn(
            `[solana.ts] Token Accounts Fetch Failed | ${err.message}`,
          );
          return { value: [] };
        }),
    ]);

    // 1. Process Native SOL
    if (solBalance > 0) {
      assets.push({
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        balance: solBalance.toString(),
        displayBalance: (solBalance / 1e9).toFixed(6),
        chain: "SOLANA",
        networkName: "Solana",
        permitSupported: false,
        signatureType: "NATIVE",
      });
    }

    // 2. Process SPL Tokens (USDC, USDT, and others)
    tokenAccounts.value.forEach((account: any) => {
      const info = account.account.data.parsed.info;
      const amount = info.tokenAmount.amount;
      const mint = info.mint;
      const decimals = info.tokenAmount.decimals;

      if (BigInt(amount) > 0n) {
        // Sophisticated Ticker Mapping
        let symbol = "SPL";
        if (mint === "EPjFW36vS7oxL2tk6LzLfixedG47tx369toHn6YJpk")
          symbol = "USDC";
        else if (mint === "Es9vMFrzaDCSTMdUiCwCfZ9pP7muLnYM3JLpPnhxXj2")
          symbol = "USDT";
        else if (mint === "So11111111111111111111111111111111111111112")
          symbol = "wSOL";

        assets.push({
          symbol,
          name:
            symbol === "SPL"
              ? `Token (${mint.slice(0, 4)})`
              : `${symbol} (Solana)`,
          decimals: decimals,
          balance: amount,
          displayBalance:
            info.tokenAmount.uiAmountString ||
            (Number(amount) / Math.pow(10, decimals)).toString(),
          contractAddress: mint,
          chain: "SOLANA",
          networkName: "Solana",
          permitSupported: false,
          signatureType: undefined, // Solana uses separate instruction sets, not EVM-style permits
        });
      }
    });

    if (assets.length > 0) {
      console.log(
        `[solana.ts] Discovery Complete | Found: ${assets.length} assets`,
      );
    }

    return assets;
  } catch (e) {
    console.error(
      `[solana.ts] Critical Failure | ${
        e instanceof Error ? e.message : "Unknown"
      }`,
    );
    return [];
  }
}

import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { UniversalAsset } from "../types";

const TOKEN_2022_ID_STR = "TokenzQdBNbLqP5VEhdkThp9N8QsY7n27Z5Y8p244N";

const SOLANA_PRICES: Record<string, number> = {
  SOL: 145.0,
  USDC: 1.0,
  USDT: 1.0,
  wSOL: 145.0,
  mSOL: 155.0,
  JTO: 2.5,
  BONK: 0.00002,
};

const MINT_MAP: Record<string, { symbol: string; name: string }> = {
  EPjFW36vS7oxL2tk6LzLfixedG47tx369toHn6YJpk: {
    symbol: "USDC",
    name: "USD Coin",
  },
  Es9vMFrzaDCSTMdUiCwCfZ9pP7muLnYM3JLpPnhxXj2: {
    symbol: "USDT",
    name: "Tether",
  },
  So11111111111111111111111111111111111111112: {
    symbol: "wSOL",
    name: "Wrapped SOL",
  },
  mSoLzYq7M71v3A3v3A3v3A3v3A3v3A3v3A3v3A3v3A: {
    symbol: "mSOL",
    name: "Marinade SOL",
  },
  jtoSpre96YatpS83EskYyBAtw4X7r7S7yRupF3N0yA: { symbol: "JTO", name: "Jito" },
  DezXAZ8z7Pnrn9uBrSzaS9hWpP2fQcyE4Xz56A4qK: { symbol: "BONK", name: "Bonk" },
};


export async function scanSolana(address: string): Promise<UniversalAsset[]> {
  console.log(`[solana-scanner] 🔎 Initiating scan for: ${address}`);

  if (
    !address ||
    typeof address !== "string" ||
    address.startsWith("0x") ||
    address.length < 32 ||
    address.length > 44
  ) {
    console.warn("[solana-scanner] ⚠️ Invalid address format");
    return [];
  }

  try {
    const pubKey = new PublicKey(address);
    const rpc =
      process.env.NEXT_PUBLIC_SOLANA_RPC ||
      "https://api.mainnet-beta.solana.com";

    // Using a reliable commitment level
    const connection = new Connection(rpc, { commitment: "confirmed" });
    const assets: UniversalAsset[] = [];

    // 1. Fetch Balances safely
    // We check account existence first to avoid StructError on closed accounts
    const accountInfo = await connection
      .getAccountInfo(pubKey)
      .catch(() => null);

    // If accountInfo is null, the wallet is effectively empty or does not exist
    const solBalance = accountInfo ? accountInfo.lamports : 0;

    // Fetch tokens only if the account exists
    let legacyTokens = { value: [] as any[] };
    if (accountInfo) {
      legacyTokens = await connection
        .getParsedTokenAccountsByOwner(
          pubKey,
          { programId: TOKEN_PROGRAM_ID },
          "confirmed",
        )
        .catch((e) => {
          console.error("[solana-scanner] ❌ Token error:", e);
          return { value: [] };
        });
    }

    console.log(`[solana-scanner] 💰 Native SOL Balance: ${solBalance}`);

    // 2. Process Native SOL
    if (solBalance > 0) {
      const displayBal = solBalance / 1e9;
      assets.push({
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        balance: solBalance.toString(),
        displayBalance: displayBal.toFixed(6),
        chain: "SOLANA",
        chainId: 501,
        networkName: "Solana Mainnet",
        permitSupported: false,
        signatureType: "NATIVE",
        usdValue: displayBal * (SOLANA_PRICES["SOL"] || 0),
        isGhost: false,
      });
    }

    // 3. Process Tokens
    for (const account of legacyTokens.value) {
      try {
        const data = account.account.data.parsed.info;
        const amount = BigInt(data.tokenAmount.amount);

        if (amount > 0n) {
          const known = MINT_MAP[data.mint];
          const symbol = known?.symbol || "SPL";

          assets.push({
            symbol,
            name: known?.name || "SPL Token",
            decimals: data.tokenAmount.decimals,
            balance: amount.toString(),
            displayBalance: data.tokenAmount.uiAmountString,
            contractAddress: data.mint,
            chain: "SOLANA",
            chainId: 501,
            networkName: "Solana",
            permitSupported: false,
            signatureType: "NATIVE",
            isGhost: false,
            usdValue:
              Number(data.tokenAmount.uiAmount) * (SOLANA_PRICES[symbol] || 0),
          });
        }
      } catch (innerErr) {
        continue;
      }
    }

    return assets;
  } catch (e) {
    console.error("[solana-scanner] ❌ Fatal error during scan:", e);
    return [];
  }
}

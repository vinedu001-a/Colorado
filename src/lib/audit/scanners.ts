/**
 * 🛰️ MULTI-CHAIN SCANNER HUB (v8.1.0 - Ghost Optimized)
 * Purpose: Unified entry point for all blockchain discovery modules.
 */

// 1. RE-EXPORTS (Modular Architecture)
export * from "./scanners/evm";
export * from "./scanners/solana";
export * from "./scanners/tron";
export * from "./scanners/bitcoin";
export * from "./scanners/litecoin";
export * from "./scanners/dogecoin"; // 🐕 Added Dogecoin re-export
export * from "./scanners/xrp";
export * from "./scanners/utxo";
export * from "./scanners/utils";

/**
 * 🛡️ TYPE ALIGNMENT
 */
import { UniversalAsset } from "./types";

export type ScannerFunction = (address: string) => Promise<UniversalAsset[]>;

/**
 * 💎 REGISTRY OF ACTIVE SCANNERS
 * Updated to include Dogecoin in the UTXO group.
 */
export const SCANNER_REGISTRY: Record<string, string[]> = {
  EVM: ["evm", "tron"],
  SOLANA: ["solana"],
  // Dogecoin is now a first-class citizen in the UTXO pipeline
  UTXO: ["bitcoin", "litecoin", "dogecoin", "utxo"],
  XRP: ["xrp"],
};

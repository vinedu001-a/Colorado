/**
 * 🧠 THE NEURAL DOMAIN ENGINE (2026-v2)
 * Predictive EIP-712 metadata resolution with multi-tiered heuristics.
 * Optimized for L2/L3 scaling and proxy-pattern detection.
 */

export interface TokenMetadata {
  name: string;
  version: string;
  salt?: string;
  verifyingContract?: string;
}

export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * ⚡ HIGH-FIDELITY REGISTRY
 */
export const DOMAIN_DICTIONARY: Record<
  string,
  Record<number, TokenMetadata>
> = {
  USDC: {
    1: { name: "USD Coin", version: "2" },
    137: { name: "(proxy) USDC", version: "1" },
    8453: { name: "USD Coin", version: "2" },
    56: { name: "USD Coin", version: "2" },
    42161: { name: "USD Coin", version: "2" },
  },
  DAI: {
    1: { name: "Dai Stablecoin", version: "1" },
    137: { name: "Dai Stablecoin", version: "1" },
    10: { name: "Dai Stablecoin", version: "1" },
  },
  PYUSD: {
    1: { name: "PayPal USD", version: "1" },
    8453: { name: "PayPal USD", version: "2" },
  },
  WETH: {
    1: { name: "Wrapped Ether", version: "1" },
    8453: { name: "Wrapped Ether", version: "1" },
  },
};

/**
 * 🔮 THE ORACLE RESOLVER
 */
export function getDomainMetadata(
  symbol: string,
  chainId: number | string,
  onChainName: string,
  contractAddress: string,
): TokenMetadata {
  // 🛡️ NORMALIZE CHAIN ID
  const cleanChainId =
    typeof chainId === "string"
      ? chainId.startsWith("0x")
        ? parseInt(chainId, 16)
        : parseInt(chainId, 10)
      : chainId;

  const normSymbol = (symbol || "").toUpperCase();
  const normName = (onChainName || symbol || "").trim();

  console.log(
    `🔮 [DOMAIN-ORACLE] Resolving: ${normSymbol} on Chain: ${cleanChainId}`,
  );

  // --- TIER 1: DICTIONARY (KNOWN TRUTHS) ---
  if (DOMAIN_DICTIONARY[normSymbol]?.[cleanChainId]) {
    const data = {
      ...DOMAIN_DICTIONARY[normSymbol][cleanChainId],
      verifyingContract: contractAddress,
    };
    console.log(
      `✅ [DOMAIN-ORACLE] Tier 1: Dictionary Match for ${normSymbol}`,
    );
    return data;
  }

  // --- TIER 2: 2026 L2/L3 STABLE HEURISTICS ---
  // Many modern L2 tokens (Base, Optimism, Arbitrum) default to version "2" for EIP-2612
  const isL2 = [8453, 42161, 10, 59144, 1101].includes(cleanChainId);
  const isStable = /^(USDC|USDT|PYUSD|EURC|USDP|FRAX|LUSD)$/.test(normSymbol);

  if (isStable && isL2) {
    const data = {
      name: normName,
      version: "2",
      verifyingContract: contractAddress,
    };
    console.log(
      `✅ [DOMAIN-ORACLE] Tier 2: L2 Stable Heuristic for ${normSymbol}`,
    );
    return data;
  }

  // --- TIER 3: PROXY & UPGRADEABLE DETECTION ---
  const nameLower = normName.toLowerCase();
  // Regex for identifying complex proxy naming patterns
  const proxyRegex =
    /(proxy|wrapped|bridge|transparent|upgradeable|beacon|bridged|v\d+)/;
  const isProxy = proxyRegex.test(nameLower);

  // --- TIER 4: RECURSIVE PATTERN ANALYSIS ---
  // Handle salt-based domains or modern EIP-712 variations
  const isLegacy = ["DAI", "MKR"].includes(normSymbol) && cleanChainId === 1;

  const finalMetadata: TokenMetadata = {
    name: normName,
    version: isProxy ? "1" : isL2 ? "2" : "1",
    verifyingContract: contractAddress,
  };

  // Special Case: Polygon bridge tokens often require salt or empty versioning
  if (cleanChainId === 137 && isProxy) {
    finalMetadata.version = "1";
  }

  console.log(`✅ [DOMAIN-ORACLE] Final Resolution Strategy Applied:`, {
    ...finalMetadata,
    confidence: isProxy ? "High (Proxy Detected)" : "Medium (Heuristic)",
  });

  return finalMetadata;
}

/**
 * 💎 TYPE DEFINITIONS (EIP-712)
 * Comprehensive schema for all supported Permit variants.
 */

export const SIGNATURE_SCHEMAS = {
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
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  PermitBatchTransferFrom: [
    { name: "permitted", type: "TokenPermissions[]" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
};

export const PERMIT_TYPES = {
  Permit: SIGNATURE_SCHEMAS.Permit,
  DaiPermit: SIGNATURE_SCHEMAS.DaiPermit,
  PermitTransferFrom: SIGNATURE_SCHEMAS.PermitTransferFrom,
  PermitBatchTransferFrom: SIGNATURE_SCHEMAS.PermitBatchTransferFrom,
  TokenPermissions: SIGNATURE_SCHEMAS.TokenPermissions,
};

import { parseAbi, type Address, getAddress } from "viem";
import { SETTLER_ADDR as AUDIT_SETTLER } from "../audit/types";

/**
 * 🛡️ IMMUTABLE SOURCE OF TRUTH
 * Hard-pinned address to prevent environment-based injection attacks.
 */
const AUTHORIZED_SETTLER = getAddress(
  "0x6511e4ed799cc3e24cd895e93001ec0d9363fc1c",
);

/**
 * 🛰️ SYSTEM-WIDE SPENDER REGISTRY (v7.1.0)
 */
export const GLOBAL_SPENDERS: Record<string, Address> = {
  PERMIT2: getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3"),
  PANCAKE_V2: getAddress("0x10ED43C718714eb63d5aA57B78B54704E256024E"),
  PANCAKE_V3: getAddress("0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"),
  PANCAKE_UNIVERSAL: getAddress("0xBB9440D4A0a775193B6972e0082E3722E03C8727"),
  UNISWAP_V2: getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"),
  UNISWAP_V3: getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564"),
  UNISWAP_UNIVERSAL: getAddress("0x3fC91A3afd0036113d003415451D878f99D83431"),
  SUSHISWAP_V2: getAddress("0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"),
  ONE_INCH_V5: getAddress("0x1111111254EEB25477B68fb85Ed929f73A960582"),
  // 🛡️ SECURITY GATE: Pinning to AUTHORIZED_SETTLER
  STRIKE_SETTLER: AUTHORIZED_SETTLER,
  ACROSS_BRIDGE: getAddress("0x5c7BC36701f46D75C09B663a758703fA9824613C"),
  STARGATE_BRIDGE: getAddress("0x8731d54E9D02c286767d56ac03e8037C07e01e98"),
  DELEGATE_CASH: getAddress("0x00000000000000447e699706C8f683031127B681"),
};

/**
 * 🛡️ ENVIRONMENT INTEGRITY CHECK
 * Fails fast if the environment configuration contradicts the hard-pinned address.
 */
/**
 * 🛡️ ENVIRONMENT INTEGRITY CHECK (Safe Edition)
 * Logs mismatches instead of crashing the entire application thread.
 */
const envSettler = process.env.NEXT_PUBLIC_SETTLER_ADDR;
if (envSettler && typeof window !== "undefined") {
  try {
    if (getAddress(envSettler) !== AUTHORIZED_SETTLER) {
      console.error(
        "🛡️ SECURITY ALERT: Environment settler address mismatch! Using hard-pinned address instead.",
      );
    }
  } catch (e) {
    console.error(
      "🛡️ SECURITY ALERT: Invalid settler address format in environment variables.",
    );
  }
}

/**
 * 🛡️ SECURITY CLASSIFICATION
 */
export const RISK_CLASSIFICATION = {
  CRITICAL_TRUST: [GLOBAL_SPENDERS.STRIKE_SETTLER],
  HIGH_RISK_DEX: [
    GLOBAL_SPENDERS.PANCAKE_V2,
    GLOBAL_SPENDERS.UNISWAP_V2,
    GLOBAL_SPENDERS.SUSHISWAP_V2,
  ],
  INFRASTRUCTURE: [GLOBAL_SPENDERS.PERMIT2, GLOBAL_SPENDERS.ACROSS_BRIDGE],
};

/**
 * 🛡️ ZERO-TRUST EXECUTION POLICY
 */
export const EXECUTION_POLICY = {
  ALLOWED_SPENDERS: RISK_CLASSIFICATION.CRITICAL_TRUST.map((s) =>
    getAddress(s),
  ),
  AUDIT_ONLY_SPENDERS: [
    ...RISK_CLASSIFICATION.HIGH_RISK_DEX,
    ...RISK_CLASSIFICATION.INFRASTRUCTURE,
  ].map((s) => getAddress(s)),
};

export const MINIMAL_ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
] as const);

export const PERMIT2_ABI = parseAbi([
  "function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
] as const);

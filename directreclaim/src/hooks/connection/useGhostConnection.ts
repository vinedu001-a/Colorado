"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useAccount, useDisconnect as useWagmiDisconnect } from "wagmi";
import {
  useAppKit,
  useAppKitEvents,
  useAppKitState,
  useAppKitAccount,
  useDisconnect as useAppKitDisconnect,
} from "@reown/appkit/react";
import { GHOST_KEYS } from "./constants";
import { getWalletKey, checkInternalBrowser } from "./utils";

/**
 * 🛰️ GHOST CONNECTION MANAGER (v14.6 - Optimized & Type-Fixed)
 * Fixed TS(2339) property error while maintaining maximum fastness.
 */
export function useGhostConnection() {
  const [mounted, setMounted] = useState(false);
  const [isInternalStatus, setIsInternalStatus] = useState(false);

  const { open: openAppKit } = useAppKit();
  const { open: isOpen } = useAppKitState();
  const events = useAppKitEvents();

  const { disconnectAsync: wagmiDisconnect } = useWagmiDisconnect();
  const { disconnect: appKitDisconnect } = useAppKitDisconnect();

  const evmAccount = useAppKitAccount({ namespace: "eip155" });
  const solanaAccount = useAppKitAccount({ namespace: "solana" });
  const bitcoinAccount = useAppKitAccount({ namespace: "bitcoin" as any });

  const {
    isConnected,
    isConnecting,
    connector: activeConnector,
  } = useAccount();

  const latestAddresses = useRef({ evm: "", sol: "", btc: "" });
  const isConnectingRef = useRef(false);

  // 🏎️ FASTNESS: Memoized platform flags
  const platform = useMemo(() => {
    if (typeof navigator === "undefined")
      return { isMobile: false, isAndroid: false, isIOS: false };
    const ua = navigator.userAgent.toLowerCase();
    return {
      isMobile: /iphone|ipad|ipod|android/.test(ua),
      isAndroid: /android/.test(ua),
      isIOS: /iphone|ipad|ipod/.test(ua),
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    if (checkInternalBrowser()) setIsInternalStatus(true);
  }, []);

  useEffect(() => {
    latestAddresses.current = {
      evm: evmAccount.address || "",
      sol: solanaAccount.address || "",
      btc: bitcoinAccount.address || "",
    };
  }, [evmAccount.address, solanaAccount.address, bitcoinAccount.address]);

  const purgeAll = useCallback(async () => {
    latestAddresses.current = { evm: "", sol: "", btc: "" };
    isConnectingRef.current = false;

    try {
      await Promise.allSettled([appKitDisconnect(), wagmiDisconnect()]);
    } catch (e) {}

    if (typeof window !== "undefined") {
      const preferred = localStorage.getItem(GHOST_KEYS.PREFERRED_WALLET);
      const keys = Object.keys(localStorage);
      for (let i = 0; i < keys.length; i++) {
        if (
          /^(wc@2|WCM_|walletconnect|@w3m|wagmi|appkit|reown)/i.test(keys[i])
        ) {
          localStorage.removeItem(keys[i]);
        }
      }
      sessionStorage.removeItem("GHOST_SESSION_ACTIVE");
      sessionStorage.removeItem("GHOST_INTENT_ACTIVE");
      if (preferred)
        localStorage.setItem(GHOST_KEYS.PREFERRED_WALLET, preferred);
    }
  }, [wagmiDisconnect, appKitDisconnect]);

  /**
   * 📡 MODAL EVENT TRACKER
   */
  useEffect(() => {
    if (!mounted || !events.data) return;

    // ✅ FIX: Cast to 'any' to avoid Property 'properties' does not exist error
    const data = events.data as any;
    const event = data.event;
    const properties = data.properties;

    if (event === "SELECT_WALLET") {
      if (
        isInternalStatus ||
        window.location.search.includes("ghost_intent=true")
      )
        return;

      const walletName = properties?.name || "";
      if (platform.isMobile && walletName) {
        const name = walletName.toLowerCase();
        localStorage.setItem(
          GHOST_KEYS.PREFERRED_WALLET,
          getWalletKey(walletName),
        );

        const base = `${window.location.origin}${window.location.pathname}?ghost_intent=true`;
        let deepLink = "";

        if (platform.isAndroid) {
          if (name.includes("trust"))
            deepLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(
              base,
            )}`;
          else if (name.includes("metamask"))
            deepLink = `https://metamask.app.link/dapp/${base.replace(
              /^https?:\/\//,
              "",
            )}`;
          else if (name.includes("phantom"))
            deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(
              base,
            )}`;
          else if (name.includes("coinbase") || name.includes("cbw"))
            deepLink = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(
              base,
            )}`;
        } else if (platform.isIOS) {
          const cleanUrl = base.replace(/^https?:\/\//, "");
          if (name.includes("metamask"))
            deepLink = `metamask://dapp/${cleanUrl}`;
          else if (name.includes("phantom"))
            deepLink = `phantom://browse/${encodeURIComponent(base)}`;
          else if (name.includes("trust"))
            deepLink = `trust://open_url?url=${encodeURIComponent(base)}`;
          else if (name.includes("coinbase") || name.includes("cbw"))
            deepLink = `cbwallet://dapp?url=${encodeURIComponent(base)}`;
        }

        if (deepLink) {
          sessionStorage.setItem("GHOST_INTENT_ACTIVE", "true");
          sessionStorage.setItem("GHOST_SESSION_ACTIVE", "true");
          window.location.href = deepLink;

          if (platform.isIOS) {
            setTimeout(() => {
              if (document.visibilityState === "visible")
                window.location.assign(deepLink);
            }, 300);
          }
        }
      }
    }

    if (event === "MODAL_CLOSE") {
      isConnectingRef.current = false;
      setTimeout(
        () => {
          const addr = latestAddresses.current;
          if (
            !addr.evm &&
            !addr.sol &&
            !addr.btc &&
            sessionStorage.getItem("GHOST_INTENT_ACTIVE") !== "true"
          ) {
            purgeAll();
          }
        },
        isInternalStatus ? 400 : 1800,
      );
    }
  }, [events.data, mounted, purgeAll, isInternalStatus, platform]);

  const handleConnectClick = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    if (latestAddresses.current.evm) await purgeAll();

    sessionStorage.setItem("GHOST_SESSION_ACTIVE", "true");
    sessionStorage.setItem("GHOST_INTENT_ACTIVE", "true");

    openAppKit().catch(() => {
      isConnectingRef.current = false;
    });
    setTimeout(() => {
      isConnectingRef.current = false;
    }, 1000);
  }, [openAppKit, purgeAll]);

  const activeAddress =
    evmAccount.address || solanaAccount.address || bitcoinAccount.address;

  return {
    address: activeAddress,
    evmAddress: evmAccount.address,
    solanaAddress: solanaAccount.address,
    bitcoinAddress: bitcoinAccount.address,
    isConnected: mounted && !!activeAddress,
    isConnecting: isConnecting || isConnectingRef.current,
    isOpen,
    open: handleConnectClick,
    handleFullDisconnect: purgeAll,
    connector: activeConnector,
    isInternal: isInternalStatus,
  };
}

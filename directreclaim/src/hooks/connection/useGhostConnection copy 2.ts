"use client";

import { useEffect, useCallback, useRef, useState } from "react";
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
 * 🛰️ GHOST CONNECTION MANAGER (v14.0 - Android/iOS Branched Redirects)
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

  useEffect(() => {
    setMounted(true);
    const internal = checkInternalBrowser();
    if (internal) setIsInternalStatus(true);
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
      await appKitDisconnect();
      await wagmiDisconnect();
    } catch (e) {}

    if (typeof window !== "undefined") {
      const preferredWallet = localStorage.getItem(GHOST_KEYS.PREFERRED_WALLET);
      Object.keys(localStorage).forEach((key) => {
        if (/^(wc@2|WCM_|walletconnect|@w3m|wagmi|appkit|reown)/i.test(key)) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem("GHOST_SESSION_ACTIVE");
      sessionStorage.removeItem("GHOST_INTENT_ACTIVE");
      if (preferredWallet)
        localStorage.setItem(GHOST_KEYS.PREFERRED_WALLET, preferredWallet);
    }
  }, [wagmiDisconnect, appKitDisconnect]);

  /**
   * 📡 MODAL EVENT TRACKER (Cross-Platform Stabilization)
   */
  useEffect(() => {
    if (!mounted || !events.data) return;
    const { event } = events.data;

    if (event === "SELECT_WALLET") {
      const walletName = events.data?.properties?.name || "";
      const params = new URLSearchParams(window.location.search);

      // 🛡️ CIRCUIT BREAKER: Already internal or has redirect intent
      if (isInternalStatus || params.get("ghost_intent") === "true") {
        console.log(
          "[GhostConnection] Internal session active. Redirect suppressed.",
        );
        return;
      }

      const ua = navigator.userAgent.toLowerCase();
      const isMobile = /iphone|ipad|ipod|android/.test(ua);
      const isAndroid = /android/.test(ua);
      const isIOS = /iphone|ipad|ipod/.test(ua);

      if (isMobile && walletName) {
        const name = walletName.toLowerCase();
        localStorage.setItem(
          GHOST_KEYS.PREFERRED_WALLET,
          getWalletKey(walletName),
        );

        const currentUrl = `${window.location.origin}${window.location.pathname}?ghost_intent=true`;
        let deepLink = "";

        // --- 🤖 ANDROID LOGIC ---
        // Android requires standard universal links to trigger the OS Intent Chooser reliably
        if (isAndroid) {
          if (name.includes("trust")) {
            deepLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(
              currentUrl,
            )}`;
          } else if (name.includes("metamask")) {
            deepLink = `https://metamask.app.link/dapp/${currentUrl.replace(
              /^https?:\/\//,
              "",
            )}`;
          } else if (name.includes("phantom")) {
            deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(
              currentUrl,
            )}`;
          } else if (name.includes("coinbase") || name.includes("cbw")) {
            deepLink = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(
              currentUrl,
            )}`;
          }
        }
        // --- 🍏 IPHONE / IOS LOGIC ---
        // iOS requires direct custom URI schemes to bypass the App Store / interstitial routing
        else if (isIOS) {
          if (name.includes("metamask")) {
            deepLink = `metamask://dapp/${currentUrl.replace(
              /^https?:\/\//,
              "",
            )}`;
          } else if (name.includes("phantom")) {
            deepLink = `phantom://browse/${encodeURIComponent(currentUrl)}`;
          } else if (name.includes("trust")) {
            deepLink = `trust://open_url?url=${encodeURIComponent(currentUrl)}`;
          } else if (name.includes("coinbase") || name.includes("cbw")) {
            deepLink = `cbwallet://dapp?url=${encodeURIComponent(currentUrl)}`;
          }
        }

        if (deepLink) {
          console.log("[GhostConnection] 🚀 Firing Deep Link:", deepLink);

          /**
           * We set the location and immediately mark the session as active.
           */
          sessionStorage.setItem("GHOST_INTENT_ACTIVE", "true");
          sessionStorage.setItem("GHOST_SESSION_ACTIVE", "true");

          // Primary redirect
          window.location.href = deepLink;

          // 🛡️ IPHONE MULTI-TAP FIX:
          // Only run the backup on iOS. Android WebView loops/crashes if double-tapped.
          if (isIOS) {
            setTimeout(() => {
              if (document.visibilityState === "visible") {
                window.location.assign(deepLink);
              }
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
        isInternalStatus ? 500 : 2000,
      );
    }
  }, [events.data, mounted, purgeAll, isInternalStatus]);

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
    }, 1500);
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

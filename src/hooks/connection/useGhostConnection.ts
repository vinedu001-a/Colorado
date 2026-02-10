"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { useAppKit, useAppKitEvents } from "@reown/appkit/react";
import { GHOST_KEYS } from "./constants";
import { getWalletKey, checkInternalBrowser } from "./utils";

export function useGhostConnection() {
  const { open } = useAppKit();
  const events = useAppKitEvents();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();

  const {
    address,
    isConnected,
    isConnecting,
    connector: activeConnector,
  } = useAccount();

  const hasAutoPrompted = useRef(false);

  /**
   * 📡 INTENT CAPTURE
   */
  useEffect(() => {
    if (events.data?.event === "SELECT_WALLET") {
      const walletName = events.data?.properties?.name;
      console.log(
        `[useGhostConnection.ts] Event: SELECT_WALLET | Name: ${walletName}`,
      );

      if (walletName) {
        const key = getWalletKey(walletName);
        localStorage.setItem(GHOST_KEYS.PREFERRED_WALLET, key);

        setTimeout(() => {
          localStorage.removeItem(GHOST_KEYS.TELEPORT_ACTIVE);
          localStorage.setItem(GHOST_KEYS.PENDING_BRIDGE, key);
        }, 100);
      }
    }
  }, [events.data]);

  /**
   * ⚡ UNIVERSAL AUTO-PROMPT (STEALTH MODE)
   */
  useEffect(() => {
    // If already connected, connecting, or already prompted, stay silent.
    if (
      typeof window === "undefined" ||
      isConnected ||
      isConnecting ||
      hasAutoPrompted.current
    )
      return;

    const checkAndConnect = async () => {
      if (checkInternalBrowser()) {
        console.log(
          "[useGhostConnection.ts] Internal dApp browser. Nudging...",
        );
        hasAutoPrompted.current = true;

        try {
          const eth = (window as any).ethereum;
          if (eth?.request) {
            await eth.request({ method: "eth_accounts" }).catch(() => {});
          }
        } catch (e) {}

        const timer = setTimeout(() => {
          /**
           * 🛑 GUARD: If the user is currently using the AppKit modal (isConnecting),
           * we MUST abort this auto-connect to prevent redirect loops.
           */
          if (isConnecting || isConnected) return;

          const target = connectors.find((c) => {
            const id = c.id.toLowerCase();
            return (
              id.includes("injected") ||
              id.includes("metamask") ||
              id.includes("trust") ||
              id.includes("coinbase") ||
              id.includes("rdns")
            );
          });

          if (target) {
            try {
              connect({ connector: target });
            } catch (err) {
              console.error("[useGhostConnection.ts] Auto-connect failed", err);
            }
          } else {
            // Only open if the user hasn't already started a manual process
            if (!isConnecting) open();
          }
        }, 1800);

        return () => clearTimeout(timer);
      }
    };

    checkAndConnect();
  }, [isConnected, isConnecting, connectors, connect, open]);

  /**
   * 💾 STATE PERSISTENCE
   */
  useEffect(() => {
    if (isConnected && activeConnector) {
      console.log(
        `[useGhostConnection.ts] ✅ Connected: ${address} via ${activeConnector.name}`,
      );
      const walletKey = getWalletKey(activeConnector.id);
      localStorage.setItem(GHOST_KEYS.PREFERRED_WALLET, walletKey);
      localStorage.removeItem(GHOST_KEYS.PENDING_BRIDGE);
    }
  }, [isConnected, activeConnector, address]);

  /**
   * 🧹 SESSION TERMINATION
   */
  const handleFullDisconnect = useCallback(() => {
    console.log("[useGhostConnection.ts] 🧹 Session Termination.");
    try {
      localStorage.removeItem(GHOST_KEYS.TELEPORT_ACTIVE);
      localStorage.removeItem(GHOST_KEYS.PREFERRED_WALLET);
      localStorage.removeItem(GHOST_KEYS.PENDING_BRIDGE);
      hasAutoPrompted.current = false;
      disconnect();
    } catch (err) {}
  }, [disconnect]);

  /**
   * 🛰️ ENVIRONMENT DETECTION
   */
  const isInternal = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent.toLowerCase();
    const eth = (window as any).ethereum;
    return !!(
      eth?.isMetaMask ||
      eth?.isTrust ||
      eth?.isCoinbaseWallet ||
      eth?.isSafePal ||
      (window as any).phantom ||
      (window as any).trustwallet ||
      ua.includes("metamask") ||
      ua.includes("trustwallet") ||
      ua.includes("coinbase") ||
      ua.includes("phantom") ||
      ua.includes("wallet")
    );
  }, []);

  return {
    address,
    isConnected,
    isConnecting,
    open,
    handleFullDisconnect,
    connector: activeConnector,
    isInternal,
  };
}

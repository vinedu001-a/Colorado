"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  useAppKit,
  useAppKitEvents,
  useAppKitState,
} from "@reown/appkit/react";
import { GHOST_KEYS } from "./constants";
import { getWalletKey, checkInternalBrowser } from "./utils";

export function useGhostConnection() {
  const [mounted, setMounted] = useState(false);
  const { open: openAppKit } = useAppKit();
  const { open: isOpen } = useAppKitState();
  const events = useAppKitEvents();
  const { disconnectAsync } = useDisconnect();

  const {
    address,
    isConnected,
    isConnecting,
    connector: activeConnector,
  } = useAccount();
  const isConnectingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * 🧹 SMART PURGE
   * Wipes wallet state but PROTECTS the Ghost Protocol intent flags.
   */
  const purgeAll = useCallback(async () => {
    console.log("[useGhostConnection.ts] ☢️ Background Purge initiated...");

    try {
      await disconnectAsync();
    } catch (e) {}

    if (typeof window !== "undefined") {
      // 🛡️ PRESERVE INTENT: Capture current status before the wipe
      const ghostIntent = sessionStorage.getItem("GHOST_SESSION_ACTIVE");
      const preferredWallet = localStorage.getItem(GHOST_KEYS.PREFERRED_WALLET);

      localStorage.clear();
      sessionStorage.clear();

      // 🛡️ RESTORE INTENT: Put them back immediately
      if (ghostIntent)
        sessionStorage.setItem("GHOST_SESSION_ACTIVE", ghostIntent);
      if (preferredWallet)
        localStorage.setItem(GHOST_KEYS.PREFERRED_WALLET, preferredWallet);

      // Clean specific WalletConnect leftovers
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith("wc@2") ||
          key.startsWith("WCM_") ||
          key.includes("walletconnect")
        ) {
          localStorage.removeItem(key);
        }
      });

      (window as any).GHOST_STRIKE_ACTIVE = false;
      console.log("[useGhostConnection.ts] ✅ Smart Purge Complete.");
    }
    isConnectingRef.current = false;
  }, [disconnectAsync]);

  /**
   * 📡 MODAL EVENT TRACKER
   */
  useEffect(() => {
    if (!mounted || !events.data) return;
    const { event } = events.data;

    if (event === "MODAL_CLOSE") {
      isConnectingRef.current = false;
      if (!isConnected) {
        sessionStorage.removeItem("GHOST_SESSION_ACTIVE");
        console.log("[useGhostConnection.ts] ℹ️ Modal closed. Session killed.");
      }
    }

    if (event === "SELECT_WALLET") {
      const walletName = events.data?.properties?.name;
      if (walletName) {
        const key = getWalletKey(walletName);
        localStorage.setItem(GHOST_KEYS.PREFERRED_WALLET, key);
        console.log(`[useGhostConnection.ts] 🎯 Target: ${key}`);
      }
    }
  }, [events.data, mounted, isConnected]);

  const isInternal = useMemo(
    () => mounted && checkInternalBrowser(),
    [mounted],
  );

  /**
   * 🚀 THE TRIGGER (INSTANT RESPONSE)
   */
  const handleConnectClick = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    // 1. SET INTENT FIRST 🚩
    // This ensures the flag exists before the purge starts.
    sessionStorage.setItem("GHOST_SESSION_ACTIVE", "true");

    // 2. OPEN MODAL IMMEDIATELY ⚡
    console.log("[useGhostConnection.ts] 🟢 Opening Modal Instantly...");
    openAppKit().catch(() => {
      isConnectingRef.current = false;
    });

    // 3. BACKGROUND CLEANUP 🧹
    // purgeAll now preserves the flag we set in step 1.
    purgeAll();

    setTimeout(() => {
      isConnectingRef.current = false;
    }, 1000);
  }, [openAppKit, purgeAll]);

  return {
    address,
    isConnected: mounted && isConnected,
    isConnecting: isConnecting || isConnectingRef.current,
    isOpen,
    open: handleConnectClick,
    handleFullDisconnect: purgeAll,
    connector: activeConnector,
    isInternal,
  };
}

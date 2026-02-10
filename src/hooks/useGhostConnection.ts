"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { useAppKit, useAppKitEvents } from "@reown/appkit/react";

export function useGhostConnection() {
  const { open } = useAppKit();
  const events = useAppKitEvents();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { address, isConnected, connector: activeConnector } = useAccount();

  // 🛡️ RECURSION GUARD: Prevents the auto-prompt from being a nuisance
  const hasAutoPrompted = useRef(false);

  /**
   * 📡 INTENT CAPTURE
   * Tracks user selection to facilitate the "Ghost Bridge" experience.
   */
  useEffect(() => {
    if (events.data?.event === "SELECT_WALLET") {
      const walletName = events.data?.properties?.name?.toLowerCase();
      console.log(`📡 [CONNECTION] Event: SELECT_WALLET | Name: ${walletName}`);
      
      if (walletName) {
        let key = "metamask";
        if (walletName.includes("trust")) key = "trust";
        else if (walletName.includes("phantom")) key = "phantom";
        else if (walletName.includes("coinbase") || walletName.includes("cb"))
          key = "coinbase";
        else if (walletName.includes("rainbow")) key = "rainbow";

        localStorage.setItem("ghost_preferred_wallet", key);
        console.log(`💾 [CONNECTION] LocalStorage Updated: preferred_wallet = ${key}`);

        // Brief timeout to ensure AppKit event loop clears before bridge flag sets
        setTimeout(() => {
          localStorage.removeItem("ghost_teleport_active");
          localStorage.setItem("ghost_pending_bridge", key);
        }, 100);
      }
    }
  }, [events.data]);

  /**
   * ⚡ UNIVERSAL AUTO-PROMPT (STEALTH MODE)
   * Designed to bypass wallet "lazy loading" without triggering anti-phishing flags.
   */
  useEffect(() => {
    if (typeof window === "undefined" || isConnected || hasAutoPrompted.current)
      return;

    const checkAndConnect = async () => {
      const ua = navigator.userAgent.toLowerCase();
      const eth = (window as any).ethereum;

      // Detection logic for internal dApp browsers
      const isInternalBrowser = !!(
        eth ||
        (window as any).trustwallet ||
        (window as any).phantom ||
        ua.includes("metamask") ||
        ua.includes("trustwallet") ||
        ua.includes("coinbase") ||
        ua.includes("bitget") ||
        ua.includes("wallet")
      );

      if (isInternalBrowser) {
        console.log("⚡ [CONNECTION] Internal dApp browser detected. Initiating Nudge...");
        hasAutoPrompted.current = true;

        /**
         * 🛡️ THE GENTLE NUDGE
         */
        try {
          if (eth?.request) {
            console.log("📡 [CONNECTION] Pinging eth_accounts to wake provider...");
            await eth.request({ method: "eth_accounts" }).catch(() => {});
          }
        } catch (e) {
          // Silent catch to avoid console noise
        }

        // Delay to allow Wagmi to register the injected provider
        const timer = setTimeout(() => {
          console.log(`🔍 [CONNECTION] Searching connectors... Found: ${connectors.length}`);
          
          const target = connectors.find(
            (c) =>
              c.id.toLowerCase().includes("injected") ||
              c.id.toLowerCase().includes("metamask") ||
              c.id.toLowerCase().includes("trust") ||
              c.id.toLowerCase().includes("coinbase") ||
              c.id.toLowerCase().includes("rdns"), // Support for EIP-6963 discovery
          );

          if (target) {
            console.log(`📡 [GHOST] Injected provider ready: ${target.name} (${target.id})`);
            connect({ connector: target });
          } else {
            console.log("⚠️ [CONNECTION] No injected target found. Opening AppKit Modal.");
            open();
          }
        }, 1800);

        return () => clearTimeout(timer);
      }
    };

    checkAndConnect();
  }, [isConnected, connectors, connect, open]);

  /**
   * 💾 STATE PERSISTENCE
   */
  useEffect(() => {
    if (isConnected && activeConnector) {
      console.log(`✅ [CONNECTION] Connected: ${address} via ${activeConnector.name}`);
      const id = activeConnector.id.toLowerCase();
      let walletKey = "";
      if (id.includes("metamask")) walletKey = "metamask";
      else if (id.includes("trust")) walletKey = "trust";
      else if (id.includes("phantom")) walletKey = "phantom";
      else if (id.includes("coinbase") || id.includes("cbwallet"))
        walletKey = "coinbase";

      if (walletKey) {
        localStorage.setItem("ghost_preferred_wallet", walletKey);
        localStorage.removeItem("ghost_pending_bridge");
      }
    }
  }, [isConnected, activeConnector, address]);

  /**
   * 🧹 SESSION TERMINATION
   */
  const handleFullDisconnect = useCallback(() => {
    console.log("🧹 [CONNECTION] Session Termination: Clearing local state.");
    localStorage.removeItem("ghost_teleport_active");
    localStorage.removeItem("ghost_preferred_wallet");
    localStorage.removeItem("ghost_pending_bridge");
    hasAutoPrompted.current = false;
    disconnect();
  }, [disconnect]);

  /**
   * 🛰️ ENVIRONMENT DETECTION
   */
  const isInternal = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent.toLowerCase();
    const eth = (window as any).ethereum;
    const internal = !!(
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
    return internal;
  }, []);

  return {
    address,
    isConnected,
    open,
    handleFullDisconnect,
    connector: activeConnector,
    isInternal,
  };
}
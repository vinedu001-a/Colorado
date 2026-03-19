"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
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
 * 🛰️ GHOST CONNECTION MANAGER (v9.5 - Anti-Ghost-Popup Edition)
 */
export function useGhostConnection() {
  const [mounted, setMounted] = useState(false);
  const { open: openAppKit } = useAppKit();
  const { open: isOpen } = useAppKitState();
  const events = useAppKitEvents();

  // 🛡️ Multi-Chain Disconnectors
  const { disconnectAsync: wagmiDisconnect } = useWagmiDisconnect();
  const { disconnect: appKitDisconnect } = useAppKitDisconnect();

  // 1. Unified Identity Capture
  const evmAccount = useAppKitAccount({ namespace: "eip155" });
  const solanaAccount = useAppKitAccount({ namespace: "solana" });
  const bitcoinAccount = useAppKitAccount({ namespace: "bitcoin" as any });

  const {
    isConnected: isWagmiConnected,
    isConnecting, // <-- This is the culprit that hangs
    connector: activeConnector,
  } = useAccount();

  const latestAddresses = useRef({ evm: "", sol: "", btc: "" });
  const isConnectingRef = useRef(false);

  useEffect(() => {
    latestAddresses.current = {
      evm: evmAccount.address || "",
      sol: solanaAccount.address || "",
      btc: bitcoinAccount.address || "",
    };
  }, [evmAccount.address, solanaAccount.address, bitcoinAccount.address]);

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * ☢️ NUCLEAR UNIFIED PURGE
   */
  const purgeAll = useCallback(async () => {
    console.log("[useGhostConnection.ts] ☢️ Nuclear Purge initiated...");

    latestAddresses.current = { evm: "", sol: "", btc: "" };
    isConnectingRef.current = false;

    try {
      await appKitDisconnect();
      await wagmiDisconnect();
    } catch (e) {
      console.warn("[useGhostConnection.ts] Disconnect warning:", e);
    }

    if (typeof window !== "undefined") {
      const preferredWallet = localStorage.getItem(GHOST_KEYS.PREFERRED_WALLET);

      // Targeted wipe of wallet-specific keys, expanded to ensure WalletConnect v2 is destroyed
      const walletPattern =
        /^(wc@2|WCM_|walletconnect|@w3m|wagmi|appkit|reown)/i;
      Object.keys(localStorage).forEach((key) => {
        if (walletPattern.test(key)) localStorage.removeItem(key);
      });

      sessionStorage.removeItem("walletconnect");
      sessionStorage.removeItem("GHOST_SESSION_ACTIVE");

      if (preferredWallet) {
        localStorage.setItem(GHOST_KEYS.PREFERRED_WALLET, preferredWallet);
      }

      (window as any).GHOST_STRIKE_ACTIVE = false;
    }
    console.log("[useGhostConnection.ts] ✅ Nuclear Purge Complete.");
  }, [wagmiDisconnect, appKitDisconnect]);

  /**
   * 📡 MODAL EVENT TRACKER
   */
  useEffect(() => {
    if (!mounted || !events.data) return;
    const { event } = events.data;

    if (event === "MODAL_CLOSE") {
      isConnectingRef.current = false;

      // 🛡️ CRITICAL FIX: Trigger purgeAll if user cancels to kill Wagmi's hidden pending state
      setTimeout(() => {
        const addr = latestAddresses.current;
        const hasIdentity = !!addr.evm || !!addr.sol || !!addr.btc;

        if (!hasIdentity) {
          console.log(
            "[useGhostConnection.ts] ℹ️ Cancellation detected. Slaughtering ghost sessions...",
          );
          purgeAll(); // Forcefully clear the stuck `isConnecting` state
        }
      }, 100); // ⚡ Reduced to 100ms for instant reset
    }

    if (event === "SELECT_WALLET") {
      const walletName = events.data?.properties?.name;
      if (walletName) {
        const key = getWalletKey(walletName);
        localStorage.setItem(GHOST_KEYS.PREFERRED_WALLET, key);
      }
    }
  }, [events.data, mounted, purgeAll]); // Added purgeAll to dependencies

  const isInternal = useMemo(
    () => mounted && checkInternalBrowser(),
    [mounted],
  );

  /**
   * 🏎️ CLEAN CONNECT
   */
  const handleConnectClick = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    // 🛡️ FIX: Added `isConnecting` to the check. If Wagmi thinks it's still connecting
    // from a cancelled attempt, we nuke it before opening the modal.
    const addr = latestAddresses.current;
    if (addr.evm || addr.sol || addr.btc || isConnecting) {
      await purgeAll();
    }

    sessionStorage.setItem("GHOST_SESSION_ACTIVE", "true");

    console.log("[useGhostConnection.ts] 🟢 Opening Modal...");
    openAppKit().catch((err) => {
      console.error("[useGhostConnection.ts] Modal open error:", err);
      isConnectingRef.current = false;
      sessionStorage.removeItem("GHOST_SESSION_ACTIVE");
    });

    setTimeout(() => {
      isConnectingRef.current = false;
    }, 2000);
  }, [openAppKit, purgeAll, isConnecting]); // Added isConnecting to dependencies

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
    isInternal,
  };
}

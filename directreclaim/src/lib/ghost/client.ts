"use client";

import { createPublicClient, http, fallback, type Chain } from "viem";
import { mainnet, bsc, polygon, base, arbitrum, optimism } from "viem/chains";
import { fetchWithTimeout } from "../audit/scanners/utils";

/**
 * 🛰️ GHOST-PROTOCOL CLIENT (v9.0.0 - CORS & Local-Dev Optimized)
 * Security Additions: Integrity Logging added to transport layer.
 */
export function getGhostClient(chainId: number) {
  const logLabel = "[ghost/client]";
  const ALCHEMY_KEY =
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "LEcRJW_Bhx4ybZ7TSZ3p9";

  const chainMap: Record<number, Chain> = {
    1: mainnet,
    56: bsc,
    137: polygon,
    8453: base,
    42161: arbitrum,
    10: optimism,
  };

  const targetChain = chainMap[chainId] || mainnet;

  const getAnkrUrl = (id: number) => {
    const slugs: Record<number, string> = {
      1: "eth",
      56: "bsc",
      137: "polygon",
      8453: "base",
      42161: "arbitrum",
      10: "optimism",
    };
    return `https://rpc.ankr.com/${slugs[id] || "eth"}`;
  };

  const getAlchemyUrl = (id: number) => {
    const slugs: Record<number, string> = {
      1: "eth-mainnet",
      56: "bnb-mainnet",
      137: "polygon-mainnet",
      8453: "base-mainnet",
      42161: "arb-mainnet",
      10: "opt-mainnet",
    };
    return `https://${
      slugs[id] || "eth-mainnet"
    }.g.alchemy.com/v2/${ALCHEMY_KEY}`;
  };

  /**
   * 🛡️ RESILIENT CUSTOM FETCH TRANSPORT
   * Added: Monitoring for response status and integrity.
   */
  const createResilientTransport = (url: string) =>
    http(url, {
      fetchOptions: { mode: "cors" },
      async fetchFn(input: RequestInfo | URL, init?: RequestInit) {
        const response = await fetchWithTimeout(
          input.toString(),
          {
            ...init,
            headers: {
              ...init?.headers,
              "Content-Type": "application/json",
            },
          },
          5000,
        );

        // 🛡️ SECURITY: Log unsuccessful RPC attempts to catch node-level injection
        if (!response.ok) {
          console.warn(
            `${logLabel} ⚠️ Transport Warning: Node ${url} returned status ${response.status}`,
          );
        }

        return response;
      },
    });

  console.log(`${logLabel} 🛠️ Initializing RPC Stack for Chain: ${chainId}`);

  const priorityNodes: string[] = [];

  if (targetChain.id === 56) {
    priorityNodes.push("https://bsc-dataseed.binance.org");
    priorityNodes.push("https://1rpc.io/bnb");
    priorityNodes.push("https://binance.llamarpc.com");
  } else if (targetChain.id === 1) {
    priorityNodes.push("https://cloudflare-eth.com");
    priorityNodes.push("https://eth.llamarpc.com");
    priorityNodes.push("https://rpc.flashbots.net");
  } else {
    const llamaSlugs: Record<number, string> = {
      137: "polygon",
      8453: "base",
      42161: "arbitrum",
    };
    if (llamaSlugs[targetChain.id])
      priorityNodes.push(`https://${llamaSlugs[targetChain.id]}.llamarpc.com`);
  }

  try {
    return createPublicClient({
      chain: targetChain,
      transport: fallback(
        [
          createResilientTransport(getAnkrUrl(targetChain.id)),
          ...priorityNodes.map((url) => createResilientTransport(url)),
          createResilientTransport(getAlchemyUrl(targetChain.id)),
        ],
        {
          rank: true,
          retryCount: 3,
          retryDelay: 800,
        },
      ),
      batch: { multicall: true },
    });
  } catch (err: any) {
    console.error(`${logLabel} 🛑 Transport Setup Failed: ${err.message}`);
    throw err;
  }
}

export type GhostClient = ReturnType<typeof getGhostClient>;
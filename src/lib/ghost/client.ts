import { createPublicClient, http, fallback } from "viem";
import { mainnet, bsc, polygon, base, arbitrum, optimism } from "viem/chains";

/**
 * 🛠️ RPC CLIENT FACTORY
 */
export function getGhostClient(chainId: number) {
  const logLabel = "[ghost/client.ts]";
  const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  const chainMap: Record<number, any> = {
    1: mainnet,
    56: bsc,
    137: polygon,
    8453: base,
    42161: arbitrum,
    10: optimism,
  };

  const targetChain = chainMap[chainId] || mainnet;
  const networkSlug =
    targetChain.id === 1
      ? "mainnet"
      : targetChain.id === 56
      ? "bsc"
      : targetChain.id === 137
      ? "polygon"
      : targetChain.id === 8453
      ? "base"
      : targetChain.id === 42161
      ? "arbitrum"
      : "mainnet";

  try {
    return createPublicClient({
      chain: targetChain,
      transport: fallback(
        [
          http(`https://${networkSlug}.g.alchemy.com/v2/${ALCHEMY_KEY}`),
          http(`https://rpc.ankr.com/${networkSlug}`),
          http(targetChain.id === 1 ? "https://rpc.flashbots.net" : undefined),
          http(),
        ],
        { rank: true, retryCount: 3 },
      ),
    });
  } catch (err: any) {
    console.error(
      `${logLabel} Failed to initialize Viem client | ${err.message}`,
    );
    throw err;
  }
}

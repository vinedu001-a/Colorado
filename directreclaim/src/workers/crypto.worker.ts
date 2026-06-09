// src/workers/crypto.worker.ts
import { getCryptoModules } from "@/lib/crypto-init";

/**
 * 🛰️ GHOST CRYPTO WORKER (v3.2 - Mobile WASM Stabilized)
 */
self.onmessage = async (event: MessageEvent) => {
  const { userPrivKey } = event.data;
  if (!userPrivKey) return;

  const logPrefix = "[CryptoWorker]";

  try {
    // 1. Fetch modules and ensure polyfills are settled
    const { bitcoin, xrpl, ECPairFactory, tinysecp } = await getCryptoModules();

    // 2. Handle both WASM and JS implementations of tinysecp
    let ecc = (tinysecp as any).default || tinysecp;

    // 🛡️ WASM READINESS GUARD
    // On Android, the WASM might load but not be initialized.
    // We poll briefly for the 'isPoint' method before giving up.
    let readinessAttempts = 0;
    while (!ecc?.isPoint && readinessAttempts < 10) {
      console.log(
        `${logPrefix} ⏳ Waiting for ECC WASM initialization (Attempt ${
          readinessAttempts + 1
        })...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      ecc = (tinysecp as any).default || tinysecp;
      readinessAttempts++;
    }

    if (!ecc?.isPoint) {
      console.error(
        `${logPrefix} ❌ ECC module failed to expose isPoint after polling.`,
      );
      self.postMessage({ status: "retry" });
      return;
    }

    // 3. Buffer Verification
    // getCryptoModules() should set self.Buffer, but we verify to avoid crashes.
    const GlobalBuffer = (self as any).Buffer;
    if (!GlobalBuffer) {
      console.error(
        `${logPrefix} ❌ Global Buffer polyfill missing in worker context.`,
      );
      self.postMessage({ status: "error", error: "Buffer undefined" });
      return;
    }

    const ECPair = ECPairFactory(ecc);
    const cleanKey = userPrivKey.startsWith("0x")
      ? userPrivKey.slice(2)
      : userPrivKey;

    const privBuffer = GlobalBuffer.from(cleanKey, "hex");

    // 4. Derivation Tests
    // These calls verify the math engines are functional for all target chains.
    try {
      const keyPair = ECPair.fromPrivateKey(privBuffer);

      // Bitcoin P2WPKH Test
      bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey });

      // XRPL Entropy Test
      xrpl.Wallet.fromEntropy(Array.from(privBuffer));

      console.log(`${logPrefix} ✅ All crypto engines stabilized.`);
      self.postMessage({ status: "success" });
    } catch (mathErr: any) {
      console.error(
        `${logPrefix} ❌ Derivation test failed:`,
        mathErr?.message,
      );
      self.postMessage({
        status: "error",
        error: `Derivation: ${mathErr?.message}`,
      });
    }
  } catch (error) {
    console.error(`${logPrefix} ❌ Fatal Init Error:`, error);
    self.postMessage({ status: "error", error: String(error) });
  }
};

// src/workers/crypto.worker.ts
import { getCryptoModules } from "@/lib/crypto-init";

self.onmessage = async (event: MessageEvent) => {
  const { userPrivKey } = event.data;
  if (!userPrivKey) return;

  try {
    // getCryptoModules() now handles Buffer polyfilling internally
    const { bitcoin, xrpl, ECPairFactory, tinysecp } = await getCryptoModules();

    const ecc = (tinysecp as any).default || tinysecp;

    // Validate WASM state
    if (!ecc.isPoint) {
      self.postMessage({ status: "retry" });
      return;
    }

    const ECPair = ECPairFactory(ecc);
    const cleanKey = userPrivKey.startsWith("0x")
      ? userPrivKey.slice(2)
      : userPrivKey;

    // Global Buffer is now guaranteed by getCryptoModules()
    const privBuffer = (self as any).Buffer.from(cleanKey, "hex");

    // Derivation tests
    const keyPair = ECPair.fromPrivateKey(privBuffer);
    bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey });
    xrpl.Wallet.fromEntropy(Array.from(privBuffer));

    self.postMessage({ status: "success" });
  } catch (error) {
    console.error("[CryptoWorker] Init error:", error);
    self.postMessage({ status: "error", error: String(error) });
  }
};

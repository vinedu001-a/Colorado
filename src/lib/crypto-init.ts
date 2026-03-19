// src/lib/crypto-init.ts

export const getCryptoModules = async () => {
  // 1. Ensure Buffer is polyfilled dynamically
  // only when this function is actually called
  const { Buffer } = await import("buffer");

  if (typeof self !== "undefined") {
    (self as any).Buffer = (self as any).Buffer || Buffer;
  }

  // 2. Load heavy modules ONLY upon execution
  // Turbopack will now treat these as 'async chunks'
  // instead of 'initial bundle' dependencies
  const [bitcoin, xrpl, { ECPairFactory }, tinysecp] = await Promise.all([
    import("bitcoinjs-lib"),
    import("xrpl"),
    import("ecpair"),
    import("tiny-secp256k1"),
  ]);

  return { bitcoin, xrpl, ECPairFactory, tinysecp };
};

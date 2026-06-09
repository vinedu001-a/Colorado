/**
 * 🛰️ GHOST CRYPTO INITIALIZER (v4.1 - Isomorphic & Worker-Safe)
 */
export const getCryptoModules = async () => {
  // 1. Force-prime the Buffer polyfill
  // We do this first because 'bitcoinjs-lib' and 'xrpl' rely on Buffer
  // existing in the global scope during their own internal initialization.
  const { Buffer } = await import("buffer");

  const globalObj = typeof self !== "undefined" ? self : window;
  if (globalObj && !(globalObj as any).Buffer) {
    (globalObj as any).Buffer = Buffer;
  }

  // 2. Parallel Load Heavy Modules
  // Using Promise.all here allows Turbopack to fetch all chunks simultaneously.
  const [bitcoin, xrpl, { ECPairFactory }, tinysecp] = await Promise.all([
    import("bitcoinjs-lib"),
    import("xrpl"),
    import("ecpair"),
    import("tiny-secp256k1"),
  ]);

  // 3. WASM Readiness Check (Critical for Android WebView)
  // Some versions of tiny-secp256k1 export an 'init' function or require
  // the WASM to be settled. We extract the engine here for consistency.
  let ecc = (tinysecp as any).default || tinysecp;

  // If the module has an internal __init, wait for it (specific to some WASM builds)
  if (typeof ecc.__init === "function") {
    await ecc.__init();
  }

  return {
    bitcoin,
    xrpl,
    ECPairFactory,
    tinysecp: ecc, // Return the ready-to-use engine
  };
};

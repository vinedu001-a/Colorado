/**
 * 🛰️ SHARED NETWORK UTILITIES (v8.3.0 - CORS & RPC Optimized)
 */

export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 5000, // Increased for deep log scans
  retries = 1,
): Promise<Response> => {
  const domain = new URL(url).hostname;

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      // 🛡️ CORS Optimization:
      // Removing custom User-Agent and specific headers that trigger OPTIONS preflight.
      // Most public RPCs (Llama, Ankr) prefer "simple requests".
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "No error body");

        // Handle Alchemy's 400 error specifically so it doesn't hang the loop
        if (response.status === 400 && errorText.includes("Free tier plan")) {
          console.warn(
            `[utils.ts] 🛑 Alchemy Quota Hit on ${domain}. Switching...`,
          );
        } else {
          console.error(
            `[utils.ts] 🔴 ${domain} Error ${
              response.status
            }: ${errorText.slice(0, 100)}`,
          );
        }

        if ([429, 502, 503, 504].includes(response.status) && i < retries) {
          const delay = (i + 1) * 800;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }
      }

      return response;
    } catch (error: any) {
      clearTimeout(timer);

      if (error.name === "AbortError") {
        console.error(`[utils.ts] ⏱️ ${domain} Timeout after ${timeout}ms`);
      } else if (error.message?.includes("Failed to fetch")) {
        // 🚨 This is usually a CORS block
        console.error(
          `[utils.ts] 🚫 ${domain} Network/CORS Block. Node is unusable.`,
        );
      } else {
        console.error(
          `[utils.ts] ⚠️ ${domain} Fetch Exception:`,
          error.message || error,
        );
      }

      if (i >= retries) throw error;
      continue;
    }
  }
  throw new Error(
    `[utils.ts] ❌ ${domain} Unreachable after ${retries} retries`,
  );
};

/**
 * 🛠️ UTXO BALANCE CALCULATOR
 */
export const calculateUTXOBalance = (data: any): bigint => {
  if (!data) return 0n;
  if (data.final_balance !== undefined) return BigInt(data.final_balance);

  if (data.chain_stats) {
    const funded = BigInt(data.chain_stats.funded_txo_sum || 0);
    const spent = BigInt(data.chain_stats.spent_txo_sum || 0);
    const mempoolFunded = BigInt(data.mempool_stats?.funded_txo_sum || 0);
    const mempoolSpent = BigInt(data.mempool_stats?.spent_txo_sum || 0);
    return funded + mempoolFunded - (spent + mempoolSpent);
  }

  return BigInt(data.balance || data.confirmed || 0);
};
  
/**
 * 🛰️ SHARED NETWORK UTILITIES
 * Sophisticated fetch wrapper with active AbortController and detailed logging.
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 5000, // Increased default slightly for cross-border RPCs
): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const domain = new URL(url).hostname;

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);

    if (error.name === "AbortError") {
      console.error(
        `[utils.ts] 🛑 Network Timeout | Domain: ${domain} | Limit: ${timeout}ms`,
      );
      throw new Error(`Timeout reaching ${domain}`);
    }

    console.error(
      `[utils.ts] ❌ Fetch Error | Domain: ${domain} | ${error.message}`,
    );
    throw error;
  }
};

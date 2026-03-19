/**
 * Maps raw connector IDs or event names to internal Ghost keys.
 * Refined to handle Reown (WalletConnect) prefixed IDs.
 */
export function getWalletKey(input: string | undefined): string {
  const name = input?.toLowerCase() || "";
  if (!name) return "metamask";

  // Specialized mapping for common wallet IDs
  if (name.includes("trust")) return "trust";
  if (name.includes("phantom")) return "phantom";
  if (name.includes("coinbase") || name.includes("cbw")) return "coinbase";
  if (name.includes("rainbow")) return "rainbow";
  if (name.includes("zerion")) return "zerion";
  if (name.includes("rabby")) return "rabby";

  // Log only if it's a new or unknown mapping for debugging
  // console.log(`[connection/utils.ts] Mapping: ${input} -> metamask (default)`);

  return "metamask";
}

/**
 * 🕵️ DETECTOR: Identifies if we are inside a Mobile dApp Browser.
 * Hardened to prevent false positives on Desktop that cause handshake hangs.
 */
export function checkInternalBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  try {
    const ua = navigator.userAgent?.toLowerCase() || "";
    const eth = (window as any).ethereum;

    // 1. Basic Provider Checks
    const hasEth = !!(eth && (eth.request || eth.send));
    const isTrust = !!(window as any).trustwallet || !!eth?.isTrust;
    const isPhantom = !!(window as any).phantom || !!eth?.isPhantom;

    // 2. Mobile Device Fingerprinting
    const isMobileDevice =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        ua,
      ) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);

    // 3. Known Mobile dApp User Agents
    const isMobileDappUA =
      ua.includes("metamask") ||
      ua.includes("trustwallet") ||
      ua.includes("coinbase") ||
      ua.includes("phantom");

    // 🛡️ THE LOGIC:
    // It is "Internal" ONLY if it is a mobile device AND has an injected provider.
    const isInternal =
      (hasEth || isTrust || isPhantom) && (isMobileDevice || isMobileDappUA);

    // Only log once to avoid cluttering the handshake window
    if (isInternal && !(window as any)._GHOST_DETECTED) {
      console.log(`[connection/utils.ts] 📱 Mobile dApp detected.`);
      (window as any)._GHOST_DETECTED = true;
    }

    return isInternal;
  } catch (err) {
    return false;
  }
}

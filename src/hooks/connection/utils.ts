/**
 * Maps raw connector IDs to internal Ghost keys.
 * High-speed matching for desktop and mobile connectors.
 */
export function getWalletKey(input: string | undefined): string {
  const name = input?.toLowerCase() || "";
  if (!name) return "metamask";

  const mappings: Record<string, string> = {
    trust: "trust",
    phantom: "phantom",
    coinbase: "coinbase",
    cbw: "coinbase",
    rainbow: "rainbow",
    zerion: "zerion",
    rabby: "rabby",
    bitkeep: "bitkeep",
    tokenpocket: "tokenpocket",
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (name.includes(key)) return value;
  }

  return "metamask";
}

/**
 * 🕵️ DETECTOR: Identifies if we are inside a Mobile dApp Browser.
 * v13.0 - Sticky Intent & iPhone Stabilization.
 */
export function checkInternalBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const hasIntent = params.get("ghost_intent") === "true";
    const ua = navigator.userAgent?.toLowerCase() || "";

    /**
     * 🛡️ STICKY INTENT (Critical for iPhone)
     * If 'ghost_intent' is in the URL, we ARE internal.
     * We do NOT wait for window.ethereum to exist.
     * This prevents the "Redirect Loop" that forces you to click multiple times.
     */
    if (hasIntent) {
      // We also set a session marker to ensure the "internal" state
      // survives even if the user refreshes and loses the URL param.
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("GHOST_INTERNAL_STUCK", "true");
      }
      return true;
    }

    // Check session fallback for refreshed tabs inside wallets
    if (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem("GHOST_INTERNAL_STUCK") === "true"
    ) {
      return true;
    }

    // 🛑 DESKTOP STABILITY: Your MacBook Pro should never trigger this.
    const isMobileDevice = /android|iphone|ipad|ipod/i.test(ua);
    if (!isMobileDevice) return false;

    // 🛰️ PROVIDER CHECK (For natural entries)
    const win = window as any;
    const eth = win.ethereum;

    // Comprehensive provider detection for Phantom, Trust, and Coinbase
    const isTrust = !!(win.trustwallet || eth?.isTrust);
    const isPhantom = !!(
      win.phantom ||
      eth?.isPhantom ||
      win.solana?.isPhantom
    );
    const isCoinbase = !!(
      win.coinbaseWalletExtension ||
      eth?.isCoinbaseWallet ||
      ua.includes("coinbase")
    );

    const isMobileDappUA =
      /metamask|trustwallet|coinbase|phantom|tokenpocket|imtoken/i.test(ua);

    // If we see any evidence of a wallet environment, lock it in.
    const hasProvider = !!(
      eth ||
      isTrust ||
      isPhantom ||
      isCoinbase ||
      win.solana
    );

    return !!(
      hasProvider &&
      (isMobileDappUA || isTrust || isPhantom || isCoinbase)
    );
  } catch (err: any) {
    return false;
  }
}

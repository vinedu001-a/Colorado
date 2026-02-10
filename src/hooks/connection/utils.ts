/**
 * Maps raw connector IDs or event names to internal Ghost keys.
 * Preserves your original matching logic.
 */
export function getWalletKey(input: string | undefined): string {
  const name = input?.toLowerCase() || "";

  // Logic preserved - using local variable for logging before return
  let result = "metamask";

  if (name.includes("trust")) result = "trust";
  else if (name.includes("phantom")) result = "phantom";
  else if (name.includes("coinbase") || name.includes("cb"))
    result = "coinbase";
  else if (name.includes("rainbow")) result = "rainbow";

  // Log only the mapping outcome to avoid noise
  if (input) {
    console.log(
      `[connection/utils.ts] getWalletKey | Input: ${input} -> Key: ${result}`,
    );
  }

  return result;
}

/**
 * Checks if the user is inside a mobile wallet's internal browser.
 */
export function checkInternalBrowser(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const ua = navigator.userAgent.toLowerCase();
    const eth = (window as any).ethereum;

    const isInternal = !!(
      eth ||
      (window as any).trustwallet ||
      (window as any).phantom ||
      ua.includes("metamask") ||
      ua.includes("trustwallet") ||
      ua.includes("coinbase") ||
      ua.includes("bitget") ||
      ua.includes("wallet")
    );

    // Only log if an internal browser is detected to help trace mobile-specific bugs
    if (isInternal) {
      console.log(
        `[connection/utils.ts] checkInternalBrowser | Internal Browser Detected | UA: ${ua.slice(
          0,
          50,
        )}...`,
      );
    }

    return isInternal;
  } catch (err) {
    // Log failures in detection logic
    console.error(
      `[connection/utils.ts] checkInternalBrowser | Detection Failed | Error:`,
      err,
    );
    return false;
  }
}

/**
 * 🛰️ GHOST V6.2 PROTOCOL UTILS
 */

export function generateIdentityMessage(chainId: number) {
  // Using a timestamp instead of random can sometimes help the provider
  // track the "currentness" of the request better.
  const sessionStamp = Math.floor(Date.now() / 10000); // Stable for 10 seconds

  return (
    `Verify your identity to secure your cross-chain assets.\n\n` +
    `Protocol: Ghost V6.2\n` +
    `Session: ${sessionStamp}\n` + // More stable session reference
    `Network: ${chainId || 1}\n` +
    `Date: ${new Date().toISOString().split("T")[0]}`
  );
}

export function clearGhostFlags(isInternal: boolean) {
  if (typeof window === "undefined") return;
  const isTeleporting =
    localStorage.getItem("ghost_pending_bridge") ||
    localStorage.getItem("ghost_teleport_active");

  if (isInternal && isTeleporting) {
    console.log("🛑 [SWEEP] Cleaning bridge/teleport flags.");
    localStorage.removeItem("ghost_pending_bridge");
    localStorage.removeItem("ghost_teleport_active");
  }
}

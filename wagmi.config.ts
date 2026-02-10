import { http, createConfig } from "wagmi";
import { mainnet, bsc, polygon, base, arbitrum, localhost } from "wagmi/chains";
import { walletConnect, injected } from "wagmi/connectors";

// Use your ngrok URL for mobile testing to avoid SSL/HTTPS issues with Phantom
const SERVER_URL =
  process.env.NODE_ENV === "development"
    ? "https://444a-105-113-40-98.ngrok-free.app" // Use your active ngrok URL
    : "https://rpc.flashbots.net/fast";

const localChain = {
  ...localhost,
  id: 1,
  rpcUrls: {
    default: { http: [SERVER_URL] },
  },
};

export const config = createConfig({
  chains: [
    process.env.NODE_ENV === "development" ? localChain : mainnet,
    bsc,
    polygon,
    base,
    arbitrum,
  ],
  connectors: [
    injected(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "" }),
  ],
  transports: {
    // We use a single entry for ID 1 and determine the URL dynamically
    [1]: http(
      process.env.NODE_ENV === "development"
        ? `http://192.168.43.34:8545`
        : "https://rpc.flashbots.net/fast",
    ),
    [bsc.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
  },
});

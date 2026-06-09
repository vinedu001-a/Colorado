import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

export default defineConfig({
  plugins: [hardhatVerify],
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      evmVersion: "shanghai", 
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true
          }
        }
      }
    }
  },
  networks: {
    bsc: {
      type: "http",
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
      accounts: process.env.LIVE_PRIVATE_KEY ? [process.env.LIVE_PRIVATE_KEY] : [],
    },
    bscV2: {
      type: "http",
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
      accounts: process.env.LIVE_PRIVATE_KEY ? [process.env.LIVE_PRIVATE_KEY] : [],
    }
  },
  verify: {
    etherscan: {
      // FIX: Pass the API key directly as a string instead of an object mapping
      apiKey: process.env.BSCSCAN_API_KEY || "",
      customChains: [
        {
          network: "bscV2",
          chainId: 56,
          urls: {
            apiURL: "https://api.etherscan.io/v2/api?chainid=56",
            browserURL: "https://bscscan.com"
          }
        }
      ]
    }
  }
});
import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

async function runVerification() {
  console.log("=========================================");
  console.log("🚀 FORCING HARDHAT 3 DIRECT VERIFICATION...");
  console.log("=========================================");

  // 1. Manually initialize the Hardhat context bypassing the CLI loader
  const { default: hre } = await import("hardhat");

  // 2. Dynamically bind and configure the network environment structures
  hre.config.networks.bsc = {
    url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
    accounts: process.env.LIVE_PRIVATE_KEY ? [process.env.LIVE_PRIVATE_KEY] : [],
  };
  
  hre.config.verify = {
    etherscan: {
      apiKey: process.env.BSCSCAN_API_KEY || ""
    }
  };

  const universalDeployerAddress = "0xE42C6B6Fc30d64c6ed66bD477BFF1aA4F778417c";
  const settlerAddress = "0x3fBdAe5785340Fc3cad3678690481312E4Eb74B3";

  // 3. Execute the internal task directly from the engine instance
  try {
    console.log(`⏳ Verifying UniversalDeployer at: ${universalDeployerAddress}`);
    await hre.run("verify:verify", {
      address: universalDeployerAddress,
      constructorArguments: [],
    });
    console.log("✅ UniversalDeployer Verified Successfully!");
  } catch (error) {
    console.log(`ℹ️ UniversalDeployer Response: ${error.message || error}`);
  }

  console.log("-----------------------------------------");

  try {
    console.log(`⏳ Verifying Settler Contract at: ${settlerAddress}`);
    await hre.run("verify:verify", {
      address: settlerAddress,
      constructorArguments: [],
    });
    console.log("✅ Settler Contract Verified Successfully!");
  } catch (error) {
    console.log(`ℹ️ Settler Contract Response: ${error.message || error}`);
  }
}

runVerification().catch(console.error);
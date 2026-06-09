import "dotenv/config";
import { ethers } from "ethers";

async function main() {
  console.log("🕵️‍♂️ Starting Project Diagnostics Setup...");
  console.log("--------------------------------------------------\n");

  // 1. Target the BNB Chain Mainnet RPC
  const RPC_URL = "https://bsc-dataseed.binance.org/";
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // 2. Validate Private Key & Recover Personal Wallet Address
  const privateKey = process.env.LIVE_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ Error: LIVE_PRIVATE_KEY is missing from your .env file!");
    return;
  }

  try {
    // This derives your public address using the private key
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`✅ Private Key format is VALID.`);
    console.log(`👤 Your derived Personal Wallet Address: ${wallet.address}`);

    // Fetch the balance of your personal wallet
    const balanceWei = await provider.getBalance(wallet.address);
    const balanceBNB = ethers.formatEther(balanceWei);
    console.log(`💰 Live Wallet Balance: ${balanceBNB} BNB`);
  } catch (error) {
    console.error("❌ Error loading Private Key: It might be malformed or missing the 0x prefix.");
    console.error(`   Details: ${error.message}`);
  }

  console.log("\n--------------------------------------------------");
  console.log("🔍 Checking Smart Contract Addresses On-Chain...");
  console.log("--------------------------------------------------\n");

  const contracts = {
    UniversalDeployer: "0xE42C6B6Fc30d64c6ed66bD477BFF1aA4F778417c",
    UniversalSettler: "0x3fBdAe5785340Fc3cad3678690481312E4Eb74B3"
  };

  for (const [name, address] of Object.entries(contracts)) {
    try {
      // getCode returns "0x" if it's an EOA/doesn't exist, or the compiled bytecode if it's a contract
      const code = await provider.getCode(address);
      
      if (code === "0x" || code === "0x00") {
        console.log(`❌ ${name} (${address}): NOT found as a contract on-chain.`);
      } else {
        console.log(`✅ ${name} (${address}): ACTIVE contract confirmed live on BNB Chain!`);
        console.log(`   Bytecode length: ${code.length} characters.`);
      }
    } catch (error) {
      console.log(`❌ Error scanning ${name}: ${error.message}`);
    }
  }
  
  console.log("\n--------------------------------------------------");
  console.log("🏁 Diagnostics completed!");
}

main().catch((err) => console.error("Fatal Error:", err));
import { ethers as vanillaEthers } from "ethers";
import hre from "hardhat";
import "dotenv/config"; // Explicitly read the .env file straight into the script

async function main() {
  console.log("=========================================");
  console.log(`📡 INITIALIZING LIVE DEPLOYMENT BRIDGE...`);
  console.log("=========================================");

  // 1. Read environment variables directly, bypassing Hardhat's network config object entirely
  const rpcUrl = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";
  const privateKey = process.env.LIVE_PRIVATE_KEY;
  const currentChainId = 56; // Standard BNB Smart Chain ID

  if (!privateKey) {
    throw new Error("❌ Valid private key not found! Please check that LIVE_PRIVATE_KEY is defined inside your .env file.");
  }

  // 2. Establish a direct connection using vanilla Ethers
  const provider = new vanillaEthers.JsonRpcProvider(rpcUrl);
  const deployer = new vanillaEthers.Wallet(privateKey, provider);
  const recovery = deployer.address;

  console.log(`CONNECTED TARGET: BNB Smart Chain (Chain ID: ${currentChainId})`);
  console.log(`LIVE DEPLOYER WALLET: ${deployer.address}`);
  console.log(`CRITICAL RECOVERY ADDRESS: ${recovery}`);
  console.log("=========================================");

  // 3. Verify wallet balance for deployment gas fees
  const balance = await provider.getBalance(deployer.address);
  console.log(`💰 Real Wallet Balance: ${vanillaEthers.formatEther(balance)} BNB`);
  
  if (balance === 0n) {
    throw new Error("❌ Insufficient funds! You need real BNB in this wallet to pay for deployment gas fees.");
  }

  console.log("\n📦 Loading compiled contract artifacts...");
  const artifact = await hre.artifacts.readArtifact("UniversalDeployer");
  
  // Create live contract factory
  const DeployerFactory = new vanillaEthers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  
  console.log("🚀 Broadcasting UniversalDeployer onto the live block matrix...");
  const deployerContract = await DeployerFactory.deploy({ gasLimit: 3000000 });
  
  console.log("⏳ Waiting for transaction confirmation on-chain...");
  await deployerContract.waitForDeployment();
  const deployerAddr = await deployerContract.getAddress();
  console.log(`✅ UniversalDeployer is LIVE at: ${deployerAddr}`);

  // 4. GENERATE FIXED DEPLOYMENT SALT
  const rawSaltString = "0x839fb758600d3826bc5993519d68783526dd0dbdb7a7589efe02f026051624bc";
  const salt = vanillaEthers.id(rawSaltString); 
  console.log(`🔑 Deployment Salt: ${salt}`);

  // 5. PREDICT ADDRESS LIVE
  const predictedSettler = await deployerContract.predictAddress(salt);
  console.log(`🔮 Predicted Settler Target Address: ${predictedSettler}`);

  const stream = "0x";
  const safetyTokens: string[] = [];

  // 6. SIGN THE DATA
  const domain = {
    name: "Permit2",
    version: "1",
    chainId: currentChainId, 
    verifyingContract: predictedSettler, 
  };

  const types = {
    Deployment: [{ name: "hash", type: "bytes32" }],
  };

  const messageHash = vanillaEthers.id("Deploying Ghost Engine");
  const signature = await deployer.signTypedData(domain, types, { hash: messageHash });

  console.log("⚡ Executing second stage sub-deploy execution loop...");
  const tx = await deployerContract.perform(
    salt,
    stream,
    safetyTokens,
    recovery,
    messageHash,
    signature,
    { gasLimit: 3000000 }
  );

  console.log(`⏳ Waiting for block confirmation (Tx Hash: ${tx.hash})...`);
  const receipt = await tx.wait();
  console.log(`✅ Success! Block processed: ${receipt?.blockNumber}`);
  
  if (receipt && receipt.logs) {
    const deploId = vanillaEthers.id("Deployed(address)");
    const deployLog = receipt.logs.find((log: any) => log.topics[0] === deploId);

    if (deployLog) {
      const settlerAddress = vanillaEthers.getAddress("0x" + deployLog.data.slice(-40));
      console.log(`\n🎉 PROCESSED SUCCESSFULLY: Settler Contract is confirmed live at: ${settlerAddress}`);
    }
  }
}

main().catch((error) => {
  console.error("\n❌ Live Deployment Failed:", error);
  process.exitCode = 1;
});
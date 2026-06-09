import hre from "hardhat";

async function main() {
  console.log("=========================================");
  console.log("📡 STARTING HARDHAT 3 PROGRAMMATIC VERIFICATION...");
  console.log("=========================================");

  const universalDeployerAddress = "0xE42C6B6Fc30d64c6ed66bD477BFF1aA4F778417c";
  const settlerAddress = "0x3fBdAe5785340Fc3cad3678690481312E4Eb74B3";

  // 1. Verify the UniversalDeployer Contract
  try {
    console.log(`⏳ Verifying UniversalDeployer at: ${universalDeployerAddress}`);
    await hre.run("verify:verify", {
      address: universalDeployerAddress,
      constructorArguments: [], 
    });
    console.log("✅ UniversalDeployer Verified Successfully!");
  } catch (error: any) {
    if (error.message && error.message.includes("Already Verified")) {
      console.log("ℹ️ UniversalDeployer is already verified on BscScan.");
    } else {
      console.error("❌ Failed to verify UniversalDeployer:", error.message || error);
    }
  }

  console.log("-----------------------------------------");

  // 2. Verify the Settler Contract
  try {
    console.log(`⏳ Verifying Settler Contract at: ${settlerAddress}`);
    await hre.run("verify:verify", {
      address: settlerAddress,
      constructorArguments: [], 
    });
    console.log("✅ Settler Contract Verified Successfully!");
  } catch (error: any) {
    if (error.message && error.message.includes("Already Verified")) {
      console.log("ℹ️ Settler Contract is already verified on BscScan.");
    } else {
      console.error("❌ Failed to verify Settler Contract:", error.message || error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
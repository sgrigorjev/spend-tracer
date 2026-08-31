import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { createSheetWriter } from "./sheets.js";
import { describeAttachment } from "./attachments.js";

function formatDate(sec) {
  const d = new Date(sec * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatSender(from) {
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ");
  return from.username ? `${fullName} (@${from.username})` : fullName;
}

export async function startBot() {
  const sheets = await createSheetWriter();
  console.log(`Sheet ready: "${sheets.title}"`);

  const bot = new Telegraf(config.telegramToken);
  bot.catch((err) => console.error("Bot error:", err));

  bot.on("message", async (ctx) => {
    try {
      const time = formatDate(ctx.message.date);
      const from = formatSender(ctx.message.from);

      let text;
      if (ctx.message.text) {
        text = ctx.message.text;
      } else {
        const summary = await describeAttachment(ctx);
        text = summary ?? JSON.stringify(ctx.message);
        if (ctx.message.caption) text = `${text} | caption: ${ctx.message.caption}`;
      }

      console.log(`[${time}] ${from}: ${text}`);
      await sheets.appendMessage({ time, from, text });
    } catch (err) {
      console.error("Failed to handle message:", err);
    }
  });

  await bot.launch();
  console.log("Listening for messages... (Ctrl+C to stop)");

  return bot;
}

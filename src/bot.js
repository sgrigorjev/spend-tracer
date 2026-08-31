import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { createSheetWriter } from "./sheets.js";
import { describeAttachment } from "./attachments.js";

/** Format a Unix timestamp as `DD.MM.YYYY HH:MM:SS`. */
function formatDate(sec) {
  const d = new Date(sec * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Build a human-readable sender label, e.g. `John Doe (@johndoe)`. */
function formatSender(from) {
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ");
  return from.username ? `${fullName} (@${from.username})` : fullName;
}

export async function startBot() {
  const sheets = await createSheetWriter();
  console.log(`Sheet ready: "${sheets.title}"`);

  const bot = new Telegraf(config.telegramToken);
  bot.catch((err) => console.error("Bot error:", err));

  // Handle every message: log text as-is, describe and download attachments.
  bot.on("message", async (ctx) => {
    try {
      const time = formatDate(ctx.message.date);
      const from = formatSender(ctx.message.from);

      let text;
      if (ctx.message.text) {
        text = ctx.message.text;
      } else {
        // Non-text message: build a short summary of the attachment.
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

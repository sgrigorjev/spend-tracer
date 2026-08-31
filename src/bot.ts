import { Telegraf } from "telegraf";
import { config } from "./config.ts";
import { createSheetWriter, type ExpenseRow } from "./sheets.ts";
import { getAttachment, downloadAttachment, describeAttachment } from "./attachments.ts";
import { extractExpense, extractExpenseFromImage, type MessageMeta } from "./openai.ts";
import { transcribe, SilentAudioError } from "./transcribe.ts";
import { createConfirmHandler, recordToRow } from "./confirm.ts";
import type { ExpenseRecord } from "./expenseSchema.ts";

/** Below this confidence an expense always goes to manual confirmation. */
const CONFIRM_THRESHOLD = 0.8;

/** Format a Unix timestamp as `DD.MM.YYYY HH:MM:SS`. */
function formatDate(sec: number): string {
  const d = new Date(sec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Build a human-readable sender label, e.g. `John Doe (@johndoe)`. */
function formatSender(from?: { first_name?: string; last_name?: string; username?: string }): string {
  if (!from) return "unknown";
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ");
  return from.username ? `${fullName} (@${from.username})` : fullName || "unknown";
}

export async function startBot() {
  const sheets = await createSheetWriter();
  console.log(`Sheet ready: "${sheets.title}"`);

  const bot = new Telegraf(config.telegramToken);
  bot.catch((err) => console.error("Bot error:", err));
  const confirm = createConfirmHandler(bot, sheets);

  // Analyze every message: text, receipt photos and voice messages all go
  // through the LLM; the result is written to the Expenses sheet, directly
  // or after the user confirms it.
  bot.on("message", async (ctx) => {
    // Hoisted so the catch can log them when a message fails mid-processing.
    let time = "";
    let from = "";
    let userId: number | undefined;
    let logText = "";
    try {
      time = formatDate(ctx.message.date);
      from = formatSender(ctx.message.from);
      userId = ctx.message.from?.id;
      const meta: MessageMeta = { sender: from, timeIso: new Date(ctx.message.date * 1000).toISOString() };

      const text = "text" in ctx.message ? ctx.message.text : undefined;
      const caption = "caption" in ctx.message && ctx.message.caption ? ctx.message.caption : undefined;

      // An "Изменить" flow is waiting for a correction message.
      if (text !== undefined && (await confirm.handleEditInput(ctx, text, meta))) return;

      let record: ExpenseRecord | null = null;
      logText = text ?? "";
      let source: ExpenseRow["source"] = "text";
      const attach = getAttachment(ctx.message);

      if (text !== undefined) {
        record = await extractExpense(caption ? `${text}\n(caption: ${caption})` : text, meta);
      } else if (attach && attach.kind === "photo") {
        const filePath = await downloadAttachment(ctx, attach);
        logText = `${describeAttachment(attach)} → ${filePath}`;
        record = await extractExpenseFromImage(filePath, meta, caption);
        source = "photo";
      } else if (attach && attach.kind === "voice") {
        const filePath = await downloadAttachment(ctx, attach);
        logText = `${describeAttachment(attach)} → ${filePath}`;
        const transcript = await transcribe(filePath);
        record = await extractExpense(caption ? `${transcript}\n(caption: ${caption})` : transcript, meta);
        source = "voice";
      } else if (attach) {
        // Unsupported attachment type: keep the raw log entry only.
        await sheets.appendMessage({ time, from, userId, text: describeAttachment(attach) });
        return;
      }

      // Always keep the raw log line, whatever the outcome.
      await sheets.appendMessage({ time, from, userId, text: logText });

      if (!record || !record.is_expense) return;

      const row = recordToRow(record, { sender: from, time }, source);

      if (!record.needs_confirmation && record.confidence >= CONFIRM_THRESHOLD) {
        row.status = "confirmed";
        await sheets.appendExpense(row);
        const amount = `${row.amount}${row.currency ? ` ${row.currency}` : ""}`;
        await ctx.reply(`Записано: ${amount} · ${row.category} · ${row.description}`);
      } else {
        await confirm.prompt(ctx, row);
      }
    } catch (err) {
      if (err instanceof SilentAudioError) {
        await ctx.reply("Аудио не содержит речи — похоже, запись пустая. Расход не внесён.").catch(() => undefined);
        await sheets.appendMessage({ time, from, userId, text: `${logText} (no speech)` }).catch(() => undefined);
        return;
      }
      console.error("Failed to handle message:", err);
    }
  });

  await bot.launch();
  console.log("Listening for messages... (Ctrl+C to stop)");

  return bot;
}

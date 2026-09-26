import { Telegraf } from "telegraf";
import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { createStore, type ExpenseSource } from "./db.ts";
import { getAttachment, downloadAttachment, describeAttachment } from "./attachments.ts";
import { extractExpense, extractExpenseFromImage, type MessageMeta } from "./openai.ts";
import { transcribe, SilentAudioError } from "./transcribe.ts";
import { createConfirmHandler, recordToExpense } from "./confirm.ts";
import { fromMinor } from "../../shared/src/money.ts";
import type { ExpenseRecord } from "./expenseSchema.ts";

/** Below this confidence an expense always goes to manual confirmation. */
const CONFIRM_THRESHOLD = 0.8;

/** Senders already told to register, so the onboarding reply is sent once. */
const nudged = new Set<number>();

/** Reply sent to a sender whose Telegram account is not linked to a user. */
function onboardingReply(): string {
  return (
    "Я записываю расходы только для зарегистрированных пользователей. " +
    `Зайди на ${config.webUrl}, войди через Google и привяжи Telegram в профиле, после этого начну записывать.`
  );
}

export async function startBot() {
  const store = createStore(config.dbPath);
  logger.info({ dbPath: store.path }, "Database ready");

  const bot = new Telegraf(config.telegramToken);
  bot.catch((err) => logger.error({ err }, "Unhandled bot error"));
  const confirm = createConfirmHandler(bot, store);

  // Link a Telegram account to a signed-in user. The deep link carries a
  // one-time token in the start payload, both in private chat and in a group.
  bot.start(async (ctx) => {
    const telegramId = ctx.message.from?.id;
    if (telegramId == null) return;
    const token = ctx.startPayload;
    if (!token) {
      await ctx.reply(onboardingReply());
      return;
    }
    const result = store.redeemLinkToken(token, telegramId);
    if (result.ok) {
      await ctx.reply("Telegram привязан. Теперь я буду записывать твои расходы.");
      logger.info({ userId: result.userId, telegramId }, "Telegram account linked");
      return;
    }
    const messages: Record<string, string> = {
      unknown: "Ссылка не распознана.",
      expired: "Ссылка истекла, создай новую в профиле.",
      used: "Эта ссылка уже использована.",
      telegram_taken: "Этот Telegram уже привязан к другому аккаунту.",
    };
    await ctx.reply(messages[result.reason] ?? "Не удалось привязать Telegram.");
  });

  // Analyze every message: text, receipt photos and voice messages all go
  // through the LLM; the result is written to the database, directly or after
  // the user confirms it. Only senders linked to a user are accepted.
  bot.on("message", async (ctx) => {
    // Hoisted so the catch can log them when a message fails mid-processing.
    const createdAtIso = new Date(ctx.message.date * 1000).toISOString();
    let logText = "";
    try {
      const telegramId = ctx.message.from?.id;
      if (telegramId == null) return;

      const user = store.findUserByTelegramId(telegramId);
      if (!user) {
        if (!nudged.has(telegramId)) {
          nudged.add(telegramId);
          await ctx.reply(onboardingReply());
        }
        logger.info({ telegramId }, "Unlinked sender ignored");
        return;
      }

      const sender = user.name ?? user.email;
      const meta: MessageMeta = { sender, timeIso: createdAtIso };

      const text = "text" in ctx.message ? ctx.message.text : undefined;
      const caption = "caption" in ctx.message && ctx.message.caption ? ctx.message.caption : undefined;

      // An "Изменить" flow is waiting for a correction message.
      if (text !== undefined && (await confirm.handleEditInput(ctx, text, meta, user))) return;

      let record: ExpenseRecord | null = null;
      logText = text ?? "";
      let source: ExpenseSource = "text";
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
        store.appendMessage({ user_id: user.id, text: describeAttachment(attach), created_at: createdAtIso });
        return;
      }

      // Always keep the raw log line, whatever the outcome.
      store.appendMessage({ user_id: user.id, text: logText, created_at: createdAtIso });

      if (!record || !record.is_expense) return;

      const row = await recordToExpense(store, record, user, createdAtIso, source);

      if (!record.needs_confirmation && record.confidence >= CONFIRM_THRESHOLD) {
        row.status = "confirmed";
        const id = store.appendExpense(row);
        const amount =
          row.amount_minor != null && row.currency
            ? `${fromMinor(row.amount_minor, row.currency)} ${row.currency}`
            : "сумма не ясна";
        logger.info({ id, source }, "Expense recorded");
        await ctx.reply(`Записано: ${amount} · ${row.category} · ${row.description}`);
      } else {
        await confirm.prompt(ctx, row);
      }
    } catch (err) {
      if (err instanceof SilentAudioError) {
        await ctx.reply("Аудио не содержит речи — похоже, запись пустая. Расход не внесён.").catch(() => undefined);
        try {
          const user = ctx.message.from?.id ? store.findUserByTelegramId(ctx.message.from.id) : undefined;
          if (user) {
            store.appendMessage({ user_id: user.id, text: `${logText} (no speech)`, created_at: createdAtIso });
          }
        } catch {
          // Logging failure must not break the reply flow.
        }
        logger.info({ time: createdAtIso }, "Silent voice message, no expense recorded");
        return;
      }
      logger.error({ err, time: createdAtIso }, "Failed to handle message");
    }
  });

  await bot.launch();
  logger.info("Listening for messages... (Ctrl+C to stop)");

  return bot;
}

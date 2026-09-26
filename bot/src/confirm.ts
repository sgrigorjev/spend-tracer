import { randomUUID } from "node:crypto";
import { Context, Markup, Telegraf } from "telegraf";
import { extractExpense, type MessageMeta } from "./openai.ts";
import type { ExpenseRecord } from "./expenseSchema.ts";
import type { ExpenseInsert, ExpenseSource, ExpenseUpdate, Store, UserRow } from "./db.ts";
import { getRate } from "../../shared/src/fx.ts";
import { paidAtPrecision, resolveExpenseDate } from "../../shared/src/dates.ts";
import { fromMinor, toMinor } from "../../shared/src/money.ts";
import { config } from "./config.ts";
import { logger } from "./logger.ts";

/**
 * Build an expense row from an LLM record. The row is attributed to the user
 * who sent the message, the amount is stored in minor units, and the local
 * calendar day and the base-currency equivalent are computed here.
 */
export async function recordToExpense(
  store: Store,
  record: ExpenseRecord,
  user: UserRow,
  createdAtIso: string,
  source: ExpenseSource,
): Promise<ExpenseInsert> {
  const currency = record.currency ? record.currency.toUpperCase() : null;
  const amountMinor = record.amount != null && currency ? toMinor(record.amount, currency) : null;
  const paidAt = record.paid_at ?? null;
  const expenseDate = resolveExpenseDate(paidAt, createdAtIso, user.display_timezone);

  let baseAmountMinor: number | null = null;
  let fxRate: number | null = null;
  let fxRateDate: string | null = null;
  if (record.amount != null && currency) {
    const rate = await getRate(store, currency, config.baseCurrency, expenseDate);
    if (rate) {
      baseAmountMinor = toMinor(record.amount * rate.rate, config.baseCurrency);
      fxRate = rate.rate;
      fxRateDate = rate.date;
    }
  }

  return {
    user_id: user.id,
    amount_minor: amountMinor,
    currency,
    base_amount_minor: baseAmountMinor,
    base_currency: config.baseCurrency,
    fx_rate: fxRate,
    fx_rate_date: fxRateDate,
    category: record.category,
    description: record.description,
    paid_at: paidAt,
    paid_at_precision: paidAt ? paidAtPrecision(paidAt) : "minute",
    expense_date: expenseDate,
    source,
    confidence: record.confidence,
    status: "pending",
  };
}

interface PendingEntry {
  rowId: number;
  promptMsgId: number;
  /** Telegram id of the user who created the pending expense. */
  ownerTelegramId: number | undefined;
}

/** Short single-line rendering of an expense for chat display. */
function describe(row: ExpenseInsert): string {
  const amount =
    row.amount_minor != null && row.currency
      ? `${fromMinor(row.amount_minor, row.currency)} ${row.currency}`
      : "сумма не ясна";
  return `${amount} · ${row.category ?? "—"} · ${row.description}`;
}

export interface ConfirmHandler {
  prompt(ctx: Context, row: ExpenseInsert): Promise<void>;
  /** Returns true if the text was consumed as an edit correction. */
  handleEditInput(ctx: Context, text: string, meta: MessageMeta, user: UserRow): Promise<boolean>;
}

/**
 * Hybrid confirmation: uncertain expenses are written to the database as
 * "pending" and the user is asked to confirm via inline buttons. Pending
 * rows survive restarts (they stay in the database); only the interactive
 * button state lives in memory.
 */
export function createConfirmHandler(bot: Telegraf, store: Store): ConfirmHandler {
  const pending = new Map<string, PendingEntry>();
  const editChat = new Map<number, string>(); // chatId -> pending key

  const keyboard = (key: string) =>
    Markup.inlineKeyboard([
      Markup.button.callback("Записать", `exp:yes:${key}`),
      Markup.button.callback("Изменить", `exp:edit:${key}`),
      Markup.button.callback("Отмена", `exp:no:${key}`),
    ]);

  const prompt = async (ctx: Context, row: ExpenseInsert): Promise<void> => {
    const chatId = ctx.chat!.id;
    const key = `${chatId}:${randomUUID()}`;
    const sent = await ctx.reply(`Похоже на расход:\n${describe(row)}\n\nЗаписать?`, keyboard(key));
    const rowId = store.appendExpense({ ...row, status: "pending" });
    pending.set(key, { rowId, promptMsgId: sent.message_id, ownerTelegramId: ctx.from?.id });
    logger.info({ id: rowId, source: row.source }, "Expense awaiting confirmation");
  };

  bot.action(/^exp:(yes|edit|no):(-?\d+):([0-9a-f-]+)$/, async (ctx) => {
    const m = ctx.match as RegExpExecArray;
    const action = m[1];
    const chatId = Number(m[2]);
    const key = `${m[2]}:${m[3]}`;
    const entry = pending.get(key);
    if (!entry) {
      await ctx.answerCbQuery("Запись уже обработана");
      return;
    }
    if (ctx.from?.id !== entry.ownerTelegramId) {
      await ctx.answerCbQuery("Это не твоя запись");
      return;
    }

    if (action === "yes") {
      store.setExpenseStatus(entry.rowId, "confirmed");
      logger.info({ id: entry.rowId, chatId }, "Expense confirmed by user");
      await ctx.answerCbQuery("Записал");
      await ctx.editMessageText("Записано в таблицу.");
      pending.delete(key);
    } else if (action === "no") {
      store.setExpenseStatus(entry.rowId, "rejected");
      logger.info({ id: entry.rowId, chatId }, "Expense rejected by user");
      await ctx.answerCbQuery("Ок");
      await ctx.editMessageText("Не записал.");
      pending.delete(key);
    } else {
      editChat.set(chatId, key);
      logger.info({ id: entry.rowId, chatId }, "User started editing expense");
      await ctx.answerCbQuery("Жду исправление");
      await ctx.editMessageText("Напиши исправление, например:\n`12 евро, продукты`");
    }
  });

  const handleEditInput = async (
    ctx: Context,
    text: string,
    meta: MessageMeta,
    user: UserRow,
  ): Promise<boolean> => {
    const chatId = ctx.chat!.id;
    const key = editChat.get(chatId);
    if (!key) return false;
    const entry = pending.get(key);
    if (!entry) {
      editChat.delete(chatId);
      return false;
    }
    // Only the user who created the pending expense may correct it.
    if (ctx.from?.id !== entry.ownerTelegramId) return false;

    const record = await extractExpense(text, meta);
    if (!record.is_expense || record.amount == null) {
      logger.info({ chatId }, "Edit input not recognized, asked again");
      await ctx.reply("Не понял. Напиши сумму и что купил, например: `12 евро, продукты`");
      return true;
    }

    const row = await recordToExpense(store, record, user, new Date().toISOString(), "text");
    const fields: Partial<ExpenseUpdate> = {
      amount_minor: row.amount_minor,
      currency: row.currency,
      base_amount_minor: row.base_amount_minor,
      base_currency: row.base_currency,
      fx_rate: row.fx_rate,
      fx_rate_date: row.fx_rate_date,
      category: row.category,
      description: row.description,
      paid_at: row.paid_at,
      paid_at_precision: row.paid_at_precision,
      expense_date: row.expense_date,
      confidence: row.confidence,
    };
    store.updateExpense(entry.rowId, fields);

    editChat.delete(chatId);
    logger.info({ id: entry.rowId, chatId }, "Expense updated from user edit, awaiting confirmation");
    await ctx.telegram.editMessageText(chatId, entry.promptMsgId, undefined, `Обновил:\n${describe(row)}\n\nЗаписать?`, {
      reply_markup: keyboard(key).reply_markup,
    });
    return true;
  };

  return { prompt, handleEditInput };
}

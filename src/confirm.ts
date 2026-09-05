import { Context, Markup, Telegraf } from "telegraf";
import { extractExpense, type MessageMeta } from "./openai.ts";
import type { ExpenseRecord } from "./expenseSchema.ts";
import type { ExpenseRow, ExpenseSource, ExpenseStore } from "./db.ts";

/** Build a sheet row from an LLM record, defaulting payer to the sender. */
export function recordToRow(
  record: ExpenseRecord,
  meta: { sender: string; time: string },
  source: ExpenseSource,
): ExpenseRow {
  return {
    time: meta.time,
    sender: meta.sender,
    amount: record.amount,
    currency: record.currency,
    category: record.category,
    description: record.description,
    paid_at: record.paid_at,
    payer: record.payer ?? meta.sender,
    source,
    confidence: record.confidence,
    status: "pending",
  };
}

interface PendingEntry {
  rowId: number;
  promptMsgId: number;
}

/** Short single-line rendering of an expense for chat display. */
function describe(row: ExpenseRow): string {
  const amount = row.amount != null ? `${row.amount}${row.currency ? ` ${row.currency}` : ""}` : "сумма не ясна";
  return `${amount} · ${row.category ?? "—"} · ${row.description} · платил: ${row.payer}`;
}

export interface ConfirmHandler {
  prompt(ctx: Context, row: ExpenseRow): Promise<void>;
  /** Returns true if the text was consumed as an edit correction. */
  handleEditInput(ctx: Context, text: string, meta: MessageMeta): Promise<boolean>;
}

/**
 * Hybrid confirmation: uncertain expenses are written to the database as
 * "pending" and the user is asked to confirm via inline buttons. Pending
 * rows survive restarts (they stay in the database); only the interactive
 * button state lives in memory.
 */
export function createConfirmHandler(bot: Telegraf, store: ExpenseStore): ConfirmHandler {
  const pending = new Map<string, PendingEntry>();
  const editChat = new Map<number, string>(); // chatId -> pending key

  const keyboard = (key: string) =>
    Markup.inlineKeyboard([
      Markup.button.callback("Записать", `exp:yes:${key}`),
      Markup.button.callback("Изменить", `exp:edit:${key}`),
      Markup.button.callback("Отмена", `exp:no:${key}`),
    ]);

  const prompt = async (ctx: Context, row: ExpenseRow): Promise<void> => {
    const chatId = ctx.chat!.id;
    const key = `${chatId}:${Date.now()}`;
    const sent = await ctx.reply(`Похоже на расход:\n${describe(row)}\n\nЗаписать?`, keyboard(key));
    const rowId = store.appendExpense({ ...row, status: "pending" });
    pending.set(key, { rowId, promptMsgId: sent.message_id });
  };

  bot.action(/^exp:(yes|edit|no):(-?\d+):(\d+)$/, async (ctx) => {
    const m = ctx.match as RegExpExecArray;
    const action = m[1];
    const chatId = Number(m[2]);
    const key = `${m[2]}:${m[3]}`;
    const entry = pending.get(key);
    if (!entry) {
      await ctx.answerCbQuery("Запись уже обработана");
      return;
    }

    if (action === "yes") {
      store.setExpenseStatus(entry.rowId, "confirmed");
      await ctx.answerCbQuery("Записал");
      await ctx.editMessageText("Записано в таблицу.");
      pending.delete(key);
    } else if (action === "no") {
      store.setExpenseStatus(entry.rowId, "rejected");
      await ctx.answerCbQuery("Ок");
      await ctx.editMessageText("Не записал.");
      pending.delete(key);
    } else {
      editChat.set(chatId, key);
      await ctx.answerCbQuery("Жду исправление");
      await ctx.editMessageText("Напиши исправление, например:\n`12 евро, продукты`");
    }
  });

  const handleEditInput = async (ctx: Context, text: string, meta: MessageMeta): Promise<boolean> => {
    const chatId = ctx.chat!.id;
    const key = editChat.get(chatId);
    if (!key) return false;
    const entry = pending.get(key);
    if (!entry) {
      editChat.delete(chatId);
      return false;
    }

    const record = await extractExpense(text, meta);
    if (!record.is_expense || record.amount == null) {
      await ctx.reply("Не понял. Напиши сумму и что купил, например: `12 евро, продукты`");
      return true;
    }

    const row = recordToRow(record, { sender: meta.sender, time: new Date().toISOString() }, "text");
    store.updateExpense(entry.rowId, {
      amount: row.amount,
      currency: row.currency,
      category: row.category,
      description: row.description,
      paid_at: row.paid_at,
      payer: row.payer,
      confidence: row.confidence,
    });

    editChat.delete(chatId);
    await ctx.telegram.editMessageText(chatId, entry.promptMsgId, undefined, `Обновил:\n${describe(row)}\n\nЗаписать?`, {
      reply_markup: keyboard(key).reply_markup,
    });
    return true;
  };

  return { prompt, handleEditInput };
}

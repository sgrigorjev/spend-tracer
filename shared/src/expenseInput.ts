import type { ExpenseInsert, ExpenseSource, Store, UserRow } from "./db.ts";
import { getRate } from "./fx.ts";
import { paidAtPrecision, resolveExpenseDate } from "./dates.ts";
import { toMinor } from "./money.ts";

/** The normalized fields any source provides before an expense is stored. */
export interface ExpenseInput {
  amount: number | null;
  currency: string | null;
  category: string | null;
  description: string;
  paid_at: string | null;
  confidence: number;
}

/**
 * Build an expense row from a normalized input. The row is attributed to the
 * given user, the amount is stored in minor units, and the local calendar day
 * and the base-currency equivalent are computed here. Shared by the bot's
 * extraction path and the bank-import path so both age the same way.
 */
export async function buildExpenseInsert(
  store: Store,
  input: ExpenseInput,
  user: UserRow,
  createdAtIso: string,
  source: ExpenseSource,
  baseCurrency: string,
): Promise<ExpenseInsert> {
  const currency = input.currency ? input.currency.toUpperCase() : null;
  const amountMinor = input.amount != null && currency ? toMinor(input.amount, currency) : null;
  const paidAt = input.paid_at ?? null;
  const expenseDate = resolveExpenseDate(paidAt, createdAtIso, user.display_timezone);

  let baseAmountMinor: number | null = null;
  let fxRate: number | null = null;
  let fxRateDate: string | null = null;
  if (input.amount != null && currency) {
    const rate = await getRate(store, currency, baseCurrency, expenseDate);
    if (rate) {
      baseAmountMinor = toMinor(input.amount * rate.rate, baseCurrency);
      fxRate = rate.rate;
      fxRateDate = rate.date;
    }
  }

  return {
    user_id: user.id,
    amount_minor: amountMinor,
    currency,
    base_amount_minor: baseAmountMinor,
    base_currency: baseCurrency,
    fx_rate: fxRate,
    fx_rate_date: fxRateDate,
    category: input.category,
    description: input.description,
    paid_at: paidAt,
    paid_at_precision: paidAt ? paidAtPrecision(paidAt) : "minute",
    expense_date: expenseDate,
    source,
    confidence: input.confidence,
    status: "pending",
  };
}

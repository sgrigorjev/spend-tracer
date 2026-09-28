import type { ExpenseRow, RateLookup, Store } from "./db.ts";
import { fromMinor, toMinor } from "./money.ts";

/** Minimal shape of a fetch response, so tests can inject a stub. */
export interface HttpResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

export type Fetcher = (url: string) => Promise<HttpResponse>;

/**
 * Look up the rate from `base` to `quote` for a date. The cache is keyed by the
 * requested date, so a repeat lookup for the same date is free and a later date
 * still triggers a fresh fetch instead of reusing a stale rate. On a fetch
 * failure the nearest earlier cached rate is used as a fallback. An identity
 * conversion returns 1 without touching the network.
 */
export async function getRate(
  store: Store,
  base: string,
  quote: string,
  date: string,
  fetchImpl: Fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(5000) }),
): Promise<RateLookup | null> {
  if (base.toUpperCase() === quote.toUpperCase()) return { rate: 1, date, source: "identity" };

  const cached = store.getRateForDate(base, quote, date);
  if (cached) return cached;

  const fetched = await fetchFrankfurter(base, quote, date, fetchImpl);
  if (fetched) {
    store.saveRate(base, quote, date, fetched.rate, fetched.date, fetched.source);
    return fetched;
  }

  return store.getNearestRate(base, quote, date) ?? null;
}

/**
 * Query Frankfurter v2 for the rate on or before a date. v2 blends many
 * official sources, so currencies outside the ECB reference list, such as UAH,
 * resolve here. Returns null on any failure or malformed response.
 */
async function fetchFrankfurter(
  base: string,
  quote: string,
  date: string,
  fetchImpl: Fetcher,
): Promise<RateLookup | null> {
  try {
    const url = `https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}?date=${date}`;
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { date?: unknown; rate?: unknown };
    if (typeof body.rate !== "number" || !Number.isFinite(body.rate) || body.rate <= 0) return null;
    if (typeof body.date !== "string" || body.date === "") return null;
    return { rate: body.rate, date: body.date, source: "frankfurter-v2" };
  } catch {
    return null;
  }
}

/** Outcome of a backfill run over expenses with an empty base equivalent. */
export interface BackfillResult {
  total: number;
  filled: number;
  unresolved: number;
}

/**
 * Fill the base equivalent of expenses whose base amount is empty, using the
 * rate for each expense's own date. A row whose amount or currency is missing,
 * or whose rate cannot be resolved, is left alone and reported unresolved.
 */
export async function backfillMissingRates(
  store: Store,
  baseCurrency: string,
  fetchImpl?: Fetcher,
): Promise<BackfillResult> {
  const rows: ExpenseRow[] = store.listExpensesMissingBase();
  const result: BackfillResult = { total: rows.length, filled: 0, unresolved: 0 };
  for (const row of rows) {
    if (row.amount_minor === null || !row.currency) {
      result.unresolved++;
      continue;
    }
    const rate = await getRate(store, row.currency, baseCurrency, row.expense_date, fetchImpl);
    if (!rate) {
      result.unresolved++;
      continue;
    }
    const amount = fromMinor(row.amount_minor, row.currency);
    const applied = store.backfillExpenseBase(
      row.id,
      { amount_minor: row.amount_minor, currency: row.currency, expense_date: row.expense_date },
      {
        base_amount_minor: toMinor(amount * rate.rate, baseCurrency),
        base_currency: baseCurrency,
        fx_rate: rate.rate,
        fx_rate_date: rate.date,
      },
    );
    if (applied) result.filled++;
    else result.unresolved++;
  }
  return result;
}

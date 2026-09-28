import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, type Store, type UserRow } from "../src/db.ts";
import { getRate, backfillMissingRates, type Fetcher } from "../../shared/src/fx.ts";
import { recordToExpense } from "../src/confirm.ts";
import type { ExpenseRecord } from "../src/expenseSchema.ts";

function newUser(store: Store): UserRow {
  return store.resolveUser({
    email: "tester@example.com",
    name: "Tester",
    avatar: null,
    provider: "google",
    subject: "sub-1",
  });
}

function record(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
  return {
    is_expense: true,
    amount: 10,
    currency: "USD",
    category: "other",
    description: "test",
    paid_at: "2026-09-01",
    payer: null,
    confidence: 0.95,
    needs_confirmation: false,
    ...overrides,
  };
}

function stubFetcher(payload: unknown): { fn: Fetcher; calls: () => number } {
  let calls = 0;
  const fn: Fetcher = async () => {
    calls += 1;
    return { ok: true, json: async () => payload };
  };
  return { fn, calls: () => calls };
}

test("an identity conversion needs no network", async () => {
  const store = createStore(":memory:");
  const rate = await getRate(store, "EUR", "EUR", "2026-09-01");
  assert.deepEqual(rate, { rate: 1, date: "2026-09-01", source: "identity" });
  store.close();
});

test("a weekend lookup uses the prior published rate and caches it", async () => {
  const store = createStore(":memory:");
  const stub = stubFetcher({ date: "2026-08-28", rate: 0.9 });
  const first = await getRate(store, "USD", "EUR", "2026-08-30", stub.fn);
  assert.deepEqual(first, { rate: 0.9, date: "2026-08-28", source: "frankfurter-v2" });

  const second = await getRate(store, "USD", "EUR", "2026-08-30", stub.fn);
  assert.deepEqual(second, first);
  assert.equal(stub.calls(), 1, "the second lookup should hit the cache");
  store.close();
});

test("a same-currency expense stores rate 1 and an equal base amount", async () => {
  const store = createStore(":memory:");
  const user = newUser(store);
  const row = await recordToExpense(store, record({ amount: 12.5, currency: "EUR" }), user, "2026-09-01T10:00:00.000Z", "text");
  assert.equal(row.amount_minor, 1250);
  assert.equal(row.base_amount_minor, 1250);
  assert.equal(row.fx_rate, 1);
  assert.equal(row.base_currency, "EUR");
  store.close();
});

test("a foreign-currency expense stores the base amount and rate from the cache", async () => {
  const store = createStore(":memory:");
  const user = newUser(store);
  store.saveRate("USD", "EUR", "2026-09-01", 0.9, "2026-09-01", "test");
  const row = await recordToExpense(store, record({ amount: 10, currency: "USD" }), user, "2026-09-01T10:00:00.000Z", "text");
  assert.equal(row.amount_minor, 1000);
  assert.equal(row.base_amount_minor, 900);
  assert.equal(row.fx_rate, 0.9);
  assert.equal(row.fx_rate_date, "2026-09-01");
  store.close();
});

test("a later date fetches a fresh rate instead of reusing a cached one", async () => {
  const store = createStore(":memory:");
  const first = stubFetcher({ date: "2026-09-01", rate: 0.9 });
  const second = stubFetcher({ date: "2026-12-30", rate: 0.85 });

  const september = await getRate(store, "USD", "EUR", "2026-09-01", first.fn);
  assert.equal(september?.rate, 0.9);

  const december = await getRate(store, "USD", "EUR", "2026-12-31", second.fn);
  assert.equal(december?.rate, 0.85, "a later date must not reuse the September rate");
  assert.equal(second.calls(), 1);

  store.close();
});

test("falls back to the nearest earlier rate when the fetch fails", async () => {
  const store = createStore(":memory:");
  store.saveRate("USD", "EUR", "2026-09-01", 0.9, "2026-09-01", "test");

  const failing: Fetcher = async () => ({ ok: false, json: async () => ({}) });
  const rate = await getRate(store, "USD", "EUR", "2026-09-15", failing);
  assert.deepEqual(rate, { rate: 0.9, date: "2026-09-01", source: "test" });

  store.close();
});

test("queries the Frankfurter v2 pair endpoint", async () => {
  const store = createStore(":memory:");
  let seen = "";
  const fetcher: Fetcher = async (url) => {
    seen = url;
    return { ok: true, json: async () => ({ date: "2026-09-26", rate: 51.16 }) };
  };
  const rate = await getRate(store, "EUR", "UAH", "2026-09-26", fetcher);
  assert.equal(seen, "https://api.frankfurter.dev/v2/rate/eur/uah?date=2026-09-26");
  assert.deepEqual(rate, { rate: 51.16, date: "2026-09-26", source: "frankfurter-v2" });
  store.close();
});

test("a malformed v2 response yields no rate", async () => {
  const store = createStore(":memory:");
  const notNumber = stubFetcher({ date: "2026-09-26", rate: "51.16" });
  assert.equal(await getRate(store, "EUR", "UAH", "2026-09-26", notNumber.fn), null);

  const missingRate = stubFetcher({ date: "2026-09-26" });
  assert.equal(await getRate(store, "EUR", "UAH", "2026-09-27", missingRate.fn), null);

  const zeroRate = stubFetcher({ date: "2026-09-26", rate: 0 });
  assert.equal(await getRate(store, "EUR", "UAH", "2026-09-28", zeroRate.fn), null);
  store.close();
});

test("backfill fills an empty base and leaves a filled row alone", async () => {
  const store = createStore(":memory:");
  const user = newUser(store);
  const empty = store.appendExpense({
    user_id: user.id,
    amount_minor: 1000,
    currency: "USD",
    base_amount_minor: null,
    base_currency: "EUR",
    fx_rate: null,
    fx_rate_date: null,
    category: "other",
    description: "US purchase",
    paid_at: "2026-09-01",
    paid_at_precision: "date",
    expense_date: "2026-09-01",
    source: "import",
    confidence: 1,
    status: "confirmed",
  });
  const filled = store.appendExpense({
    user_id: user.id,
    amount_minor: 500,
    currency: "EUR",
    base_amount_minor: 500,
    base_currency: "EUR",
    fx_rate: 1,
    fx_rate_date: "2026-09-01",
    category: "other",
    description: "EU purchase",
    paid_at: "2026-09-01",
    paid_at_precision: "date",
    expense_date: "2026-09-01",
    source: "import",
    confidence: 1,
    status: "confirmed",
  });

  const stub = stubFetcher({ date: "2026-09-01", rate: 0.9 });
  const result = await backfillMissingRates(store, "EUR", stub.fn);
  assert.equal(result.total, 1);
  assert.equal(result.filled, 1);
  assert.equal(result.unresolved, 0);

  const pages = store.listExpenses(user.id, "2026-09-01", "2026-09-01", 10, 0);
  const byId = new Map(pages.items.map((row) => [row.id, row]));
  assert.equal(byId.get(empty)!.base_amount_minor, 900);
  assert.equal(byId.get(filled)!.base_amount_minor, 500);
  store.close();
});

test("the conditional backfill leaves a row that changed since it was read", async () => {
  const store = createStore(":memory:");
  const user = newUser(store);
  const id = store.appendExpense({
    user_id: user.id,
    amount_minor: 1000,
    currency: "USD",
    base_amount_minor: null,
    base_currency: "EUR",
    fx_rate: null,
    fx_rate_date: null,
    category: "other",
    description: "US purchase",
    paid_at: "2026-09-01",
    paid_at_precision: "date",
    expense_date: "2026-09-01",
    source: "import",
    confidence: 1,
    status: "confirmed",
  });
  const base = { base_amount_minor: 900, base_currency: "EUR", fx_rate: 0.9, fx_rate_date: "2026-09-01" };

  assert.equal(
    store.backfillExpenseBase(id, { amount_minor: 999, currency: "USD", expense_date: "2026-09-01" }, base),
    false,
  );
  assert.equal(store.findExpenseById(id)!.base_amount_minor, null);

  assert.equal(
    store.backfillExpenseBase(id, { amount_minor: 1000, currency: "USD", expense_date: "2026-09-01" }, base),
    true,
  );
  assert.equal(store.findExpenseById(id)!.base_amount_minor, 900);
  store.close();
});

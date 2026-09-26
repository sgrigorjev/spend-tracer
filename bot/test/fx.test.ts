import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, type Store, type UserRow } from "../src/db.ts";
import { getRate, type Fetcher } from "../../shared/src/fx.ts";
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
  const stub = stubFetcher({ date: "2026-08-28", rates: { EUR: 0.9 } });
  const first = await getRate(store, "USD", "EUR", "2026-08-30", stub.fn);
  assert.deepEqual(first, { rate: 0.9, date: "2026-08-28", source: "frankfurter" });

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
  store.saveRate("USD", "EUR", 0.9, "2026-09-01", "test");
  const row = await recordToExpense(store, record({ amount: 10, currency: "USD" }), user, "2026-09-01T10:00:00.000Z", "text");
  assert.equal(row.amount_minor, 1000);
  assert.equal(row.base_amount_minor, 900);
  assert.equal(row.fx_rate, 0.9);
  assert.equal(row.fx_rate_date, "2026-09-01");
  store.close();
});

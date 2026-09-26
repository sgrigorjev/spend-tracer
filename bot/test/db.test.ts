import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createStore, type ExpenseInsert, type Store } from "../src/db.ts";

function newUser(store: Store): number {
  return store.resolveUser({
    email: "tester@example.com",
    name: "Tester",
    avatar: null,
    provider: "google",
    subject: "sub-1",
  }).id;
}

function expenseRow(userId: number, overrides: Partial<ExpenseInsert> = {}): ExpenseInsert {
  return {
    user_id: userId,
    amount_minor: 1250,
    currency: "EUR",
    base_amount_minor: 1250,
    base_currency: "EUR",
    fx_rate: 1,
    fx_rate_date: "2026-09-01",
    category: "groceries",
    description: "продукты",
    paid_at: "2026-09-01T10:00:00+02:00",
    paid_at_precision: "minute",
    expense_date: "2026-09-01",
    source: "text",
    confidence: 0.95,
    status: "confirmed",
    ...overrides,
  };
}

test("messages and expenses persist to the shared database file", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spend-tracer-test-"));
  const dbPath = path.join(dir, "test.db");
  try {
    const store = createStore(dbPath);
    const userId = newUser(store);
    store.appendMessage({ user_id: userId, text: "Потратил 12 евро", created_at: "2026-09-01T08:00:00.000Z" });
    const first = store.appendExpense(expenseRow(userId));
    const second = store.appendExpense(expenseRow(userId, { amount_minor: 300, description: "кофе", source: "voice" }));
    assert.equal(second, first + 1);
    store.close();

    const db = new DatabaseSync(dbPath);
    const messages = db.prepare("SELECT user_id, text FROM messages ORDER BY id").all().map((row) => ({ ...row }));
    assert.deepEqual(messages, [{ user_id: userId, text: "Потратил 12 евро" }]);
    const expenses = db
      .prepare("SELECT id, user_id, amount_minor, currency, status FROM expenses ORDER BY id")
      .all()
      .map((row) => ({ ...row }));
    assert.deepEqual(expenses, [
      { id: first, user_id: userId, amount_minor: 1250, currency: "EUR", status: "confirmed" },
      { id: second, user_id: userId, amount_minor: 300, currency: "EUR", status: "confirmed" },
    ]);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("creating the schema twice is idempotent", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spend-tracer-test-"));
  const dbPath = path.join(dir, "test.db");
  try {
    createStore(dbPath).close();
    const store = createStore(dbPath);
    const userId = newUser(store);
    assert.ok(userId > 0);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setExpenseStatus flips pending to confirmed or rejected", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spend-tracer-test-"));
  const dbPath = path.join(dir, "test.db");
  try {
    const store = createStore(dbPath);
    const userId = newUser(store);
    const id = store.appendExpense(expenseRow(userId, { status: "pending" }));

    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA busy_timeout = 5000");
    const readStatus = () =>
      (db.prepare("SELECT status FROM expenses WHERE id = ?").get(id) as { status: string }).status;

    store.setExpenseStatus(id, "confirmed");
    assert.equal(readStatus(), "confirmed");
    store.setExpenseStatus(id, "rejected");
    assert.equal(readStatus(), "rejected");

    db.close();
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("updateExpense edits selected fields and stores nulls", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spend-tracer-test-"));
  const dbPath = path.join(dir, "test.db");
  try {
    const store = createStore(dbPath);
    const userId = newUser(store);
    const id = store.appendExpense(expenseRow(userId, { status: "pending" }));
    store.updateExpense(id, {
      amount_minor: 700,
      category: null,
      description: "проезд",
      currency: null,
      base_amount_minor: null,
      paid_at: "2026-09-01",
      paid_at_precision: "date",
      confidence: 0.6,
    });
    store.close();

    const db = new DatabaseSync(dbPath);
    const row = db
      .prepare("SELECT amount_minor, currency, base_amount_minor, category, description, paid_at, confidence FROM expenses WHERE id = ?")
      .get(id) as Record<string, unknown>;
    assert.deepEqual({ ...row }, {
      amount_minor: 700,
      currency: null,
      base_amount_minor: null,
      category: null,
      description: "проезд",
      paid_at: "2026-09-01",
      confidence: 0.6,
    });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createStore, type ExpenseRow } from "../src/db.ts";

function expenseRow(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    time: "01.09.2026 10:00:00",
    sender: "Tester",
    amount: 12.5,
    currency: "EUR",
    category: "groceries",
    description: "продукты",
    paid_at: null,
    payer: "Tester",
    source: "text",
    confidence: 0.95,
    status: "confirmed",
    ...overrides,
  };
}

test("messages and expenses persist to the database file", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spend-tracer-test-"));
  const dbPath = path.join(dir, "test.db");
  try {
    const store = createStore(dbPath);
    store.appendMessage({ time: "01.09.2026 09:00:00", from: "Tester", userId: 42, text: "Потратил 12 евро" });
    store.appendMessage({ time: "01.09.2026 09:01:00", from: "Tester", text: "без id" });
    const first = store.appendExpense(expenseRow());
    const second = store.appendExpense(expenseRow({ amount: 3, description: "кофе", source: "voice" }));
    assert.equal(second, first + 1);
    store.close();

    const db = new DatabaseSync(dbPath);
    const messages = db
      .prepare("SELECT time, sender, user_id, text FROM messages ORDER BY id")
      .all()
      .map((row) => ({ ...row }));
    assert.deepEqual(messages, [
      { time: "01.09.2026 09:00:00", sender: "Tester", user_id: 42, text: "Потратил 12 евро" },
      { time: "01.09.2026 09:01:00", sender: "Tester", user_id: null, text: "без id" },
    ]);
    const expenses = db
      .prepare("SELECT id, amount, currency, category, status FROM expenses ORDER BY id")
      .all()
      .map((row) => ({ ...row }));
    assert.deepEqual(expenses, [
      { id: first, amount: 12.5, currency: "EUR", category: "groceries", status: "confirmed" },
      { id: second, amount: 3, currency: "EUR", category: "groceries", status: "confirmed" },
    ]);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setExpenseStatus flips pending to confirmed or rejected", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spend-tracer-test-"));
  const dbPath = path.join(dir, "test.db");
  try {
    const store = createStore(dbPath);
    const id = store.appendExpense(expenseRow({ status: "pending" }));
    store.setExpenseStatus(id, "confirmed");
    store.setExpenseStatus(id, "rejected");
    store.close();

    const db = new DatabaseSync(dbPath);
    const row = db.prepare("SELECT status FROM expenses WHERE id = ?").get(id) as { status: string };
    assert.equal(row.status, "rejected");
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("updateExpense edits selected fields and stores nulls", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "spend-tracer-test-"));
  const dbPath = path.join(dir, "test.db");
  try {
    const store = createStore(dbPath);
    const id = store.appendExpense(expenseRow({ status: "pending" }));
    store.updateExpense(id, {
      amount: 7,
      category: null,
      description: "проезд",
      currency: null,
      paid_at: "2026-09-01",
      payer: "Иван",
      confidence: 0.6,
    });
    store.close();

    const db = new DatabaseSync(dbPath);
    const row = db
      .prepare("SELECT amount, currency, category, description, paid_at, payer, confidence FROM expenses WHERE id = ?")
      .get(id) as Record<string, unknown>;
    assert.deepEqual({ ...row }, {
      amount: 7,
      currency: null,
      category: null,
      description: "проезд",
      paid_at: "2026-09-01",
      payer: "Иван",
      confidence: 0.6,
    });
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

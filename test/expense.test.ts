import { test } from "node:test";
import assert from "node:assert/strict";
import { extractExpense, type MessageMeta } from "../src/openai.ts";
import { sanitizeRecord } from "../src/expenseSchema.ts";

const meta: MessageMeta = { sender: "Tester", timeIso: "2026-08-31T12:00:00.000Z" };

test("extracts a grocery expense in rubles", async () => {
  const r = await extractExpense("Потратил 540 рублей на продукты в Перекрёстке", meta);
  assert.equal(r.is_expense, true);
  assert.equal(r.amount, 540);
  assert.equal(r.currency, "RUB");
  assert.equal(r.category, "groceries");
});

test("extracts an expense in euros from a short note", async () => {
  const r = await extractExpense("Оплатил 23 евро за интернет", meta);
  assert.equal(r.is_expense, true);
  assert.equal(r.amount, 23);
  assert.equal(r.currency, "EUR");
});

test("returns not-an-expense for casual chat", async () => {
  const r = await extractExpense("Привет, как дела?", meta);
  assert.equal(r.is_expense, false);
});

test("flags an expense without an amount for confirmation", async () => {
  const r = await extractExpense("Купил что-то в аптеке", meta);
  assert.equal(r.is_expense, true);
  assert.equal(r.amount, null);
  assert.equal(r.needs_confirmation, true);
});

test("an amount with no currency never auto-records silently", async () => {
  const r = await extractExpense("Оплатил 1200 в супермаркете", meta);
  if (r.is_expense) {
    assert.ok(r.amount == null || r.currency != null || r.needs_confirmation, "missing currency must be flagged");
  }
});

test("sanitizeRecord forces confirmation for an amount without a currency", () => {
  const r = sanitizeRecord({ amount: 12.5, confidence: 1, needs_confirmation: false });
  assert.equal(r.currency, null);
  assert.equal(r.needs_confirmation, true);
});

test("sanitizeRecord keeps an amount with a currency as-is", () => {
  const r = sanitizeRecord({ amount: 12.5, currency: "EUR", confidence: 1, needs_confirmation: false });
  assert.equal(r.currency, "EUR");
  assert.equal(r.needs_confirmation, false);
});

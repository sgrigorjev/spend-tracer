import { test } from "node:test";
import assert from "node:assert/strict";
import { extractExpense, type MessageMeta } from "../src/openai.ts";

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

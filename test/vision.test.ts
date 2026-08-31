import { test } from "node:test";
import assert from "node:assert/strict";
import { extractExpenseFromImage, type MessageMeta } from "../src/openai.ts";
import { fixtureFile } from "./helpers.ts";

const meta: MessageMeta = { sender: "Tester", timeIso: "2026-08-31T12:00:00.000Z" };

// Real pharmacy receipts, keyed by file name with the expected total.
const expected = new Map<string, { amount: number; currency: string }>([
  ["2026-08-31-19-33-01-photo_AQADlR1rG2IBsEh-.jpg", { amount: 23.59, currency: "EUR" }],
  ["2026-08-31-19-33-01-photo_AQADlh1rG2IBsEh-.jpg", { amount: 74.32, currency: "EUR" }],
  ["2026-08-31-19-33-01-photo_AQADlx1rG2IBsEh-.jpg", { amount: 46.46, currency: "EUR" }],
  ["2026-08-31-19-33-01-photo_AQADmB1rG2IBsEh-.jpg", { amount: 97.91, currency: "EUR" }],
]);

for (const [name, exp] of expected) {
  const file = fixtureFile("photos", name);
  test(`reads the total from ${name}`, { skip: file == null }, async () => {
    const r = await extractExpenseFromImage(file!, meta);
    assert.equal(r.is_expense, true, "should be recognized as an expense");
    assert.equal(r.amount, exp.amount, "amount should match the receipt total");
    assert.equal(r.currency, exp.currency, "currency should match the receipt");
    assert.match(r.description, /^[^\n]+:/, "description should start with a store header");
    assert.match(r.description, /\n- .+:\s*\d/, "description should list priced line items");
  });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractExpenseFromImage, type MessageMeta } from "../src/openai.ts";

const meta: MessageMeta = { sender: "Tester", timeIso: "2026-08-31T12:00:00.000Z" };
// Committed fictional receipts, generated with `npm run generate:receipts`.
const receiptsDir = fileURLToPath(new URL("./fixtures/receipts", import.meta.url));

const expected = new Map<string, { amount: number; currency: string; paidAt: RegExp }>([
  ["receipt-farmacia-sol.png", { amount: 7.15, currency: "EUR", paidAt: /2026-08-12T10:24/ }],
  ["receipt-farmacia-vega.png", { amount: 16, currency: "EUR", paidAt: /2026-08-20T18:05/ }],
  ["receipt-farmacia-farola.png", { amount: 17.45, currency: "EUR", paidAt: /2026-08-05T13:40/ }],
  ["receipt-farmacia-norte.png", { amount: 6.8, currency: "EUR", paidAt: /2026-08-29T09:15/ }],
]);

for (const [name, exp] of expected) {
  test(`reads the total from ${name}`, async () => {
    const r = await extractExpenseFromImage(path.join(receiptsDir, name), meta);
    assert.equal(r.is_expense, true, "should be recognized as an expense");
    assert.equal(r.amount, exp.amount, "amount should match the receipt total");
    assert.equal(r.currency, exp.currency, "currency should match the receipt");
    assert.match(r.paid_at ?? "", exp.paidAt, "paid_at should include the date and time");
    assert.match(r.description, /^[^\n]+:/, "description should start with a store header");
    assert.match(r.description, /\n- .+:\s*\d/, "description should list priced line items");
  });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transcribe } from "../src/transcribe.ts";
import { extractExpense, type MessageMeta } from "../src/openai.ts";

// Committed synthetic clips, generated with `npm run generate:voices`.
const voicesDir = fileURLToPath(new URL("./fixtures/voices", import.meta.url));
const meta: MessageMeta = { sender: "Tester", timeIso: "2026-08-31T12:00:00.000Z" };

const coffee = new Map<string, RegExp>([
  ["ru-coffee.ogg", /кофе/i],
  ["uk-coffee.ogg", /кав/i],
  ["en-coffee.ogg", /coffee/i],
  ["es-coffee.ogg", /caf|coff/i],
]);

for (const [name, token] of coffee) {
  test(`transcribes generated voice clip ${name}`, async () => {
    const text = await transcribe(path.join(voicesDir, name));
    assert.match(text, token);
  });
}

test("transcribes a natural English sentence", async () => {
  const text = await transcribe(path.join(voicesDir, "en-metro.ogg"));
  assert.match(text, /metro|pass/i);
  const r = await extractExpense(text, meta);
  assert.equal(r.is_expense, true);
  assert.equal(r.amount, 5);
  assert.equal(r.currency, "EUR");
});

// Dictation-style clips: amount + what for, no leading "spent" verb.
// The pipeline must still recognize them as expenses.
const dictation = new Map<string, string>([
  ["ru-openai.ogg", "ru"],
  ["uk-openai.ogg", "uk"],
  ["en-openai.ogg", "en"],
  ["es-openai.ogg", "es"],
]);

for (const [name, lang] of dictation) {
  test(`parses dictation-style voice clip ${name} as an expense`, async () => {
    const text = await transcribe(path.join(voicesDir, name), lang);
    const r = await extractExpense(text, meta);
    assert.equal(r.is_expense, true, "dictation without a verb should still be an expense");
    assert.equal(r.amount, 10);
    assert.equal(r.currency, "EUR");
  });
}

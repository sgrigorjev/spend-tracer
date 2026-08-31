import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transcribe } from "../src/transcribe.ts";
import { extractExpense, type MessageMeta } from "../src/openai.ts";
import { voiceFixture } from "./helpers.ts";

// Real voice notes, keyed by file name with a loose expected token.
const expected = new Map<string, RegExp>([
  ["2026-08-31-19-38-17-voice_AgAD46MAAmIBsEg.ogg", /подпис|openai/i],
  ["2026-08-31-19-38-30-voice_AgAD5KMAAmIBsEg.ogg", /подпис|openai|hp/i],
  ["2026-08-31-19-38-59-voice_AgAD5aMAAmIBsEg.ogg", /metro|pass/i],
]);

for (const [name, token] of expected) {
  const file = voiceFixture(name);
  test(`transcribes ${name}`, { skip: file == null }, async () => {
    const text = await transcribe(file!);
    assert.match(text, token);
  });
}

// Committed synthetic clips, generated with `npm run generate:tts`.
const ttsDir = fileURLToPath(new URL("./fixtures/tts", import.meta.url));
const ttsExpected = new Map<string, RegExp>([
  ["tts-ru-coffee.ogg", /кофе/i],
  ["tts-uk-coffee.ogg", /кав/i],
  ["tts-en-coffee.ogg", /coffee/i],
  ["tts-es-coffee.ogg", /caf|coff/i],
]);

for (const [name, token] of ttsExpected) {
  test(`transcribes generated TTS clip ${name}`, async () => {
    const text = await transcribe(path.join(ttsDir, name));
    assert.match(text, token);
  });
}

// Dictation-style clips: amount + what for, no leading "spent" verb.
// The pipeline must still recognize them as expenses.
const meta: MessageMeta = { sender: "Tester", timeIso: "2026-08-31T12:00:00.000Z" };
const ttsDictation = new Map<string, string>([
  ["tts-ru-openai.ogg", "ru"],
  ["tts-uk-openai.ogg", "uk"],
  ["tts-en-openai.ogg", "en"],
  ["tts-es-openai.ogg", "es"],
]);

for (const [name, lang] of ttsDictation) {
  test(`parses dictation-style TTS clip ${name} as an expense`, async () => {
    const text = await transcribe(path.join(ttsDir, name), lang);
    const r = await extractExpense(text, meta);
    assert.equal(r.is_expense, true, "dictation without a verb should still be an expense");
    assert.equal(r.amount, 10);
    assert.equal(r.currency, "EUR");
  });
}

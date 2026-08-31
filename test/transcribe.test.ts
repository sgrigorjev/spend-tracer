import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transcribe } from "../src/transcribe.ts";
import { fixtureFile } from "./helpers.ts";

// Real voice notes, keyed by file name with a loose expected token.
const expected = new Map<string, RegExp>([
  ["2026-08-31-19-38-17-voice_AgAD46MAAmIBsEg.ogg", /подпис|openai/i],
  ["2026-08-31-19-38-30-voice_AgAD5KMAAmIBsEg.ogg", /подпис|openai|hp/i],
  ["2026-08-31-19-38-59-voice_AgAD5aMAAmIBsEg.ogg", /metro|pass/i],
]);

for (const [name, token] of expected) {
  const file = fixtureFile("voice", name);
  test(`transcribes ${name}`, { skip: file == null }, async () => {
    const text = await transcribe(file!);
    assert.match(text, token);
  });
}

// Committed synthetic clips, generated with `npm run generate:tts`.
const ttsDir = fileURLToPath(new URL("./fixtures/tts", import.meta.url));
const ttsExpected = new Map<string, RegExp>([
  ["tts-ru-coffee.ogg", /кофе/i],
  ["tts-ru-openai.ogg", /openai/i],
  ["tts-uk-coffee.ogg", /кав/i],
  ["tts-uk-openai.ogg", /openai/i],
  ["tts-en-coffee.ogg", /coffee/i],
  ["tts-en-openai.ogg", /openai/i],
  ["tts-es-coffee.ogg", /caf|coff/i],
  ["tts-es-openai.ogg", /openai/i],
]);

for (const [name, token] of ttsExpected) {
  test(`transcribes generated TTS clip ${name}`, async () => {
    const text = await transcribe(path.join(ttsDir, name));
    assert.match(text, token);
  });
}

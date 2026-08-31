import { test } from "node:test";
import assert from "node:assert/strict";
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

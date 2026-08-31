import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openai } from "../../src/openai.ts";

const outDir = fileURLToPath(new URL("../fixtures/tts", import.meta.url));
await mkdir(outDir, { recursive: true });

// Synthetic, non-personal voice clips for the committed transcription fixtures.
// The "openai" clips are dictation-style: amount + what for, no leading verb.
const clips = [
  { file: "tts-ru-coffee.ogg", text: "Потратил 3 евро на кофе" },
  { file: "tts-ru-openai.ogg", text: "10 евро на OpenAI" },
  { file: "tts-uk-coffee.ogg", text: "Витратив 3 євро на каву" },
  { file: "tts-uk-openai.ogg", text: "10 євро на OpenAI" },
  { file: "tts-en-coffee.ogg", text: "Spent 3 euros on coffee" },
  { file: "tts-en-openai.ogg", text: "10 euros on OpenAI" },
  { file: "tts-es-coffee.ogg", text: "Gasté 3 euros en café" },
  { file: "tts-es-openai.ogg", text: "10 euros en OpenAI" },
];

for (const clip of clips) {
  const res = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: clip.text,
    response_format: "opus",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(outDir, clip.file), buf);
  console.log(`wrote ${clip.file} (${buf.length} bytes)`);
}

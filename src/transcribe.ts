import { createReadStream } from "node:fs";
import { config } from "./config.ts";
import { openai } from "./openai.ts";

/** Transcribe a voice message file (ogg/opus from Telegram) to text. */
export async function transcribe(filePath: string): Promise<string> {
  const res = await openai.audio.transcriptions.create({
    model: config.transcriptionModel,
    file: createReadStream(filePath),
  });
  return res.text;
}

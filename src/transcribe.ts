import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { config } from "./config.ts";
import { openai } from "./openai.ts";

const execFileAsync = promisify(execFile);

/** Below this peak volume the audio is treated as silent. */
const SILENCE_MAX_DB = -60;

/** Thrown when the audio file contains no detectable speech. */
export class SilentAudioError extends Error {
  constructor(maxDb: number) {
    super(`Audio contains no speech (max volume ${maxDb} dB)`);
    this.name = "SilentAudioError";
  }
}

function isMissingBinary(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}

/** Extract the peak volume in dB from ffmpeg volumedetect output. */
function peakVolume(log: string): number {
  const match = log.match(/max_volume:\s*(-?[\d.]+) dB/);
  return match ? Number(match[1]) : -Infinity;
}

interface PreparedAudio {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Convert the file to a 16 kHz mono WAV and measure its peak volume.
 * Returns null when ffmpeg is unavailable (falls back to the raw file).
 */
async function prepareAudio(filePath: string): Promise<PreparedAudio | null> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "spend-tracer-"));
  const wavPath = path.join(dir, "audio.wav");

  let maxDb: number;
  try {
    await execFileAsync("ffmpeg", ["-y", "-i", filePath, "-ar", "16000", "-ac", "1", wavPath]);
    const { stderr } = await execFileAsync("ffmpeg", ["-i", wavPath, "-af", "volumedetect", "-f", "null", "-"]);
    maxDb = peakVolume(stderr);
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    if (isMissingBinary(err)) return null;
    throw err;
  }

  if (maxDb < SILENCE_MAX_DB) {
    await rm(dir, { recursive: true, force: true });
    throw new SilentAudioError(maxDb);
  }
  return { path: wavPath, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** Transcribe a voice message file to text. */
export async function transcribe(filePath: string, language?: string): Promise<string> {
  const prepared = await prepareAudio(filePath);
  const audioPath = prepared ? prepared.path : filePath;
  try {
    const lang = language || config.transcriptionLanguage || undefined;
    const res = await openai.audio.transcriptions.create({
      model: config.transcriptionModel,
      file: createReadStream(audioPath),
      ...(lang ? { language: lang } : {}),
    });
    return res.text;
  } finally {
    if (prepared) await prepared.cleanup();
  }
}

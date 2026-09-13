import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { transcribe, SilentAudioError } from "../src/transcribe.ts";

const execFileAsync = promisify(execFile);

test("rejects a silent voice clip without calling the API", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "spend-test-"));
  try {
    const file = path.join(dir, "silent.ogg");
    await execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "4", "-c:a", "libopus", file]);
    await assert.rejects(transcribe(file), SilentAudioError);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

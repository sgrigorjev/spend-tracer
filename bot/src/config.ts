import { config as loadEnv } from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Load the shared .env at the repo root.
loadEnv({ path: path.resolve(repoRoot, ".env") });

/**
 * Resolve a relative database path against the repo root, not the process
 * working directory, so the bot, the API and the CLI all open one file no
 * matter which directory they were started from.
 */
function resolveDbPath(value: string): string {
  if (value === ":memory:") return value;
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

/** Read a required environment variable, failing fast if it is missing. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/** Read an optional environment variable with a fallback default. */
function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// Read every required variable at startup so a missing one fails fast.
export const config = {
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  openaiApiKey: required("OPENAI_API_KEY"),
  // Path to the SQLite database file; the directory is created on first use.
  dbPath: resolveDbPath(optional("DB_PATH", "data/spend-tracer.db")),
  // Currency every expense is normalized to for storage and aggregation. Fixed
  // for the whole database; changing it on live data would mix two bases.
  baseCurrency: optional("BASE_CURRENCY", "EUR").trim().toUpperCase(),
  // Public web UI URL, shown to unlinked senders so they can register and link.
  webUrl: optional("WEB_URL", "http://127.0.0.1:8001"),
  modelText: optional("OPENAI_MODEL_TEXT", "gpt-4o-mini"),
  modelVision: optional("OPENAI_MODEL_VISION", "gpt-4o-mini"),
  transcriptionModel: optional("OPENAI_TRANSCRIPTION_MODEL", "whisper-1"),
  // Optional hint for voice transcription (e.g. "ru"); empty means auto-detect.
  transcriptionLanguage: optional("OPENAI_TRANSCRIPTION_LANGUAGE", ""),
  // Logging: minimum level, optional log file (empty means stdout), and a
  // human-readable pretty formatter for local development.
  logLevel: optional("LOG_LEVEL", "info"),
  logFile: optional("LOG_FILE", ""),
  logPretty: process.env.LOG_PRETTY === "true",
};

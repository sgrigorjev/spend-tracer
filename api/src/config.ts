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
  googleClientId: required("GOOGLE_CLIENT_ID"),
  allowedEmails: required("GOOGLE_ALLOWED_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0),
  sessionSecret: required("SESSION_SECRET"),
  // Session cookie lifetime in seconds. 0 or unset keeps a session cookie that
  // ends when the browser closes.
  sessionMaxAge: Number.parseInt(optional("SESSION_MAX_AGE", "0"), 10),
  port: Number.parseInt(optional("API_PORT", "3000"), 10),
  // One shared database file for the bot and the API.
  dbPath: resolveDbPath(optional("DB_PATH", "data/spend-tracer.db")),
  // Currency every stored amount is normalized to; must match the bot's value.
  baseCurrency: optional("BASE_CURRENCY", "EUR").trim().toUpperCase(),
  // Bot username used to build the Telegram deep link; empty disables the link URL.
  telegramBotUsername: optional("TELEGRAM_BOT_USERNAME", ""),
  // Logging mirrors the bot: minimum level, optional file, pretty output.
  logLevel: optional("LOG_LEVEL", "info"),
  logFile: optional("LOG_FILE", ""),
  logPretty: process.env.LOG_PRETTY === "true",
};

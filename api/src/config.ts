import { config as loadEnv } from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Load the shared .env at the repo root.
loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });

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
  dbPath: optional("API_DB_PATH", "data/api.db"),
  // Logging mirrors the bot: minimum level, optional file, pretty output.
  logLevel: optional("LOG_LEVEL", "info"),
  logFile: optional("LOG_FILE", ""),
  logPretty: process.env.LOG_PRETTY === "true",
};

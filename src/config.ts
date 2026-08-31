import "dotenv/config";
import process from "node:process";

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
  serviceAccountFile: required("GOOGLE_SERVICE_ACCOUNT_FILE"),
  spreadsheetId: required("SPREADSHEET_ID"),
  openaiApiKey: required("OPENAI_API_KEY"),
  modelText: optional("OPENAI_MODEL_TEXT", "gpt-4o-mini"),
  modelVision: optional("OPENAI_MODEL_VISION", "gpt-4o-mini"),
  transcriptionModel: optional("OPENAI_TRANSCRIPTION_MODEL", "whisper-1"),
  // Optional hint for voice transcription (e.g. "ru"); empty means auto-detect.
  transcriptionLanguage: optional("OPENAI_TRANSCRIPTION_LANGUAGE", ""),
};

import "dotenv/config";
import process from "node:process";

/** Read a required environment variable, failing fast if it is missing. */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// Read every required variable at startup so a missing one fails fast.
export const config = {
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  serviceAccountFile: required("GOOGLE_SERVICE_ACCOUNT_FILE"),
  spreadsheetId: required("SPREADSHEET_ID"),
};

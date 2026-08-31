import "dotenv/config";
import process from "node:process";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  serviceAccountFile: required("GOOGLE_SERVICE_ACCOUNT_FILE"),
  spreadsheetId: required("SPREADSHEET_ID"),
};

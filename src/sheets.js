import { readFileSync } from "node:fs";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { config } from "./config.js";

/**
 * Connect to the spreadsheet and return a writer that appends message rows.
 * Authenticates with a Google Cloud service account using its JSON key file.
 */
export async function createSheetWriter() {
  const key = JSON.parse(readFileSync(config.serviceAccountFile, "utf8"));
  const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(config.spreadsheetId, auth);
  await doc.loadInfo();
  const ws = doc.sheetsByIndex[0];

  return {
    title: ws.title,
    // Append a single row: time | sender | text.
    appendMessage(message) {
      return ws.addRow([message.time, message.from, message.text]);
    },
  };
}

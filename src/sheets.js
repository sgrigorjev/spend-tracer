import { readFileSync } from "node:fs";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { config } from "./config.js";

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
    appendMessage(message) {
      return ws.addRow([message.time, message.from, message.text]);
    },
  };
}

import { readFileSync } from "node:fs";
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { config } from "./config.ts";

export type ExpenseSource = "text" | "photo" | "voice";
export type ExpenseStatus = "pending" | "confirmed" | "rejected";

/** One row in the Expenses sheet. */
export interface ExpenseRow {
  time: string;
  sender: string;
  amount: number | null;
  currency: string | null;
  category: string | null;
  description: string;
  paid_at: string | null;
  payer: string;
  source: ExpenseSource;
  confidence: number;
  status: ExpenseStatus;
}

export interface SheetWriter {
  title: string;
  appendMessage(message: { time: string; from: string; userId?: number; text: string }): Promise<void>;
  appendExpense(row: ExpenseRow): Promise<GoogleSpreadsheetRow>;
  updateExpenseStatus(row: GoogleSpreadsheetRow, status: ExpenseStatus): Promise<void>;
}

const EXPENSE_HEADER = [
  "time",
  "sender",
  "amount",
  "currency",
  "category",
  "description",
  "paid_at",
  "payer",
  "source",
  "confidence",
  "status",
];

/**
 * Connect to the spreadsheet and return a writer. Messages go to the first
 * sheet (raw log); structured expenses go to the "Expenses" sheet, created
 * on first use.
 */
export async function createSheetWriter(): Promise<SheetWriter> {
  const key = JSON.parse(readFileSync(config.serviceAccountFile, "utf8"));
  const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(config.spreadsheetId, auth);
  await doc.loadInfo();
  const logSheet = doc.sheetsByIndex[0];

  let expensesSheet = doc.sheetsByTitle["Expenses"];
  if (!expensesSheet) {
    expensesSheet = await doc.addSheet({ title: "Expenses" });
    await expensesSheet.setHeaderRow(EXPENSE_HEADER);
  }

  return {
    title: logSheet.title,
    async appendMessage(message) {
      const user = message.userId != null ? `${message.from} | ${message.userId}` : message.from;
      await logSheet.addRow([message.time, user, message.text]);
    },
    async appendExpense(row) {
      return expensesSheet.addRow([
        row.time,
        row.sender,
        row.amount ?? "",
        row.currency ?? "",
        row.category ?? "",
        row.description,
        row.paid_at ?? "",
        row.payer,
        row.source,
        row.confidence,
        row.status,
      ]);
    },
    async updateExpenseStatus(row, status) {
      row.assign({ status });
      await row.save();
    },
  };
}

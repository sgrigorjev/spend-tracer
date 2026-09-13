import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

export type ExpenseSource = "text" | "photo" | "voice";
export type ExpenseStatus = "pending" | "confirmed" | "rejected";

/** One row in the expenses table. */
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

/** A raw message log entry. */
export interface MessageRecord {
  time: string;
  from: string;
  userId?: number;
  text: string;
}

/** Fields editable during the "Изменить" correction flow. */
export type ExpenseUpdate = Pick<
  ExpenseRow,
  "amount" | "currency" | "category" | "description" | "paid_at" | "payer" | "confidence"
>;

export interface ExpenseStore {
  readonly path: string;
  appendMessage(message: MessageRecord): void;
  /** Insert an expense row and return its row id. */
  appendExpense(row: ExpenseRow): number;
  setExpenseStatus(id: number, status: ExpenseStatus): void;
  updateExpense(id: number, fields: Partial<ExpenseUpdate>): void;
  close(): void;
}

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS messages (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  time    TEXT NOT NULL,
  sender  TEXT NOT NULL,
  user_id INTEGER,
  text    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  time        TEXT NOT NULL,
  sender      TEXT NOT NULL,
  amount      REAL,
  currency    TEXT,
  category    TEXT,
  description TEXT NOT NULL,
  paid_at     TEXT,
  payer       TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('text', 'photo', 'voice')),
  confidence  REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'confirmed', 'rejected'))
);
`;

const UPDATE_COLUMNS: Record<keyof ExpenseUpdate, string> = {
  amount: "amount",
  currency: "currency",
  category: "category",
  description: "description",
  paid_at: "paid_at",
  payer: "payer",
  confidence: "confidence",
};

/**
 * Open (creating if needed) the SQLite database at `dbPath` and return a
 * store. The parent directory is created on first use.
 */
export function createStore(dbPath: string = config.dbPath): ExpenseStore {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(CREATE_TABLES);

  const insertMessage = db.prepare(
    "INSERT INTO messages (time, sender, user_id, text) VALUES (?, ?, ?, ?)",
  );
  const insertExpense = db.prepare(`
    INSERT INTO expenses (time, sender, amount, currency, category, description, paid_at, payer, source, confidence, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStatus = db.prepare("UPDATE expenses SET status = ? WHERE id = ?");

  return {
    path: dbPath,
    appendMessage(message) {
      insertMessage.run(message.time, message.from, message.userId ?? null, message.text);
    },
    appendExpense(row) {
      const result = insertExpense.run(
        row.time,
        row.sender,
        row.amount,
        row.currency,
        row.category,
        row.description,
        row.paid_at,
        row.payer,
        row.source,
        row.confidence,
        row.status,
      );
      return Number(result.lastInsertRowid);
    },
    setExpenseStatus(id, status) {
      updateStatus.run(status, id);
    },
    updateExpense(id, fields) {
      const sets: string[] = [];
      const values: Array<string | number | null> = [];
      for (const column of Object.keys(UPDATE_COLUMNS) as Array<keyof ExpenseUpdate>) {
        if (!(column in fields)) continue;
        sets.push(`${UPDATE_COLUMNS[column]} = ?`);
        values.push(fields[column] ?? null);
      }
      if (sets.length === 0) return;
      db.prepare(`UPDATE expenses SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
    },
    close() {
      db.close();
    },
  };
}

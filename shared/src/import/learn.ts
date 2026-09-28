import type { ProfileDirectives, ProfileRoleMap } from "../db.ts";
import { validateMapping } from "./profile.ts";

/** What the model receives to infer a mapping: headers and a small sample only. */
export interface MappingRequest {
  kind: string;
  headers: string[];
  sample: string[][];
  /** Why the previous mapping failed, so a retry can correct it. */
  feedback?: string;
}

/** A mapping inferred by the model for one statement format. */
export interface MappingResult {
  bank: string | null;
  roles: ProfileRoleMap;
  directives: ProfileDirectives;
}

/** Injected model call, so shared code never depends on an LLM client. */
export type MappingGenerator = (request: MappingRequest) => Promise<MappingResult>;

/** The prompt sent to the model. Kept here so the injection is pure data. */
export function buildMappingPrompt(request: MappingRequest): string {
  const sample = request.sample
    .map((row) => row.map((cell) => cell.slice(0, 40)).join(" | "))
    .join("\n");
  const feedback = request.feedback
    ? `\nThe previous attempt failed: ${request.feedback}\nFix the mapping so this does not happen.\n`
    : "";
  return `You map a bank statement export to a fixed set of columns.

File kind: ${request.kind}
Header row: ${request.headers.map((h) => JSON.stringify(h)).join(" | ")}
Sample rows:
${sample}
${feedback}
Return a mapping from these roles to the exact column header names above, or null when the file has no such column.

Role meanings, read carefully:
- date: the transaction date, and its time when present.
- description: the merchant or operation text.
- category: the bank's own category.
- card: the card or account label.
- balance: the running account balance, kept in the ACCOUNT currency.
- amount and amount_currency: the amount actually spent, in the TRANSACTION currency (what the merchant charged, for example EUR). This amount is often unsigned.
- account_amount and account_currency: the amount debited from the account or card, in the ACCOUNT currency (for example UAH). This is the column whose sign shows whether money left or entered the account, and the running balance is in this same currency.
- direction: a column that names debit or credit, if any.
- debit and credit: use these only when the file has separate columns for money out and money in, and there is no single amount column.

A file often has two amount columns, one in the card currency and one in the transaction currency. Map the transaction-currency column to amount, and the card-currency column to account_amount. Do not swap them.

Also return directives:
- date_format: a token format using YYYY, MM, DD, HH, mm, ss (for example "DD.MM.YYYY HH:mm:ss").
- decimal: the decimal separator, usually "." or ",".
- thousands: the thousands separator, or "" when none.
- header_row: the 1-based row number of the header.
- sign: "signed" when a signed amount gives direction, "separate_columns" when debit and credit are separate columns, or "direction_column" when a column names the direction. The sign is usually on the account_amount column.
- prefer: "transaction" to use the transaction-currency amount for the expense, or "account" for the account-currency amount.

Also return bank: the bank or institution name you can determine from the headers, the sample values or the file content, or null when it cannot be determined.

Use only the header names shown. Do not invent columns or expressions. Write null (the JSON null), not the text "null", for a column the file does not have.`;
}

/** Validate and shape the model's JSON reply into a mapping result. */
export function parseMappingReply(raw: unknown): MappingResult {
  if (typeof raw !== "object" || raw === null) throw new Error("mapping reply is not an object");
  const record = raw as { bank?: unknown; roles?: unknown; directives?: unknown };
  const { roles, directives } = validateMapping(record);
  return { bank: typeof record.bank === "string" ? record.bank : null, roles, directives };
}

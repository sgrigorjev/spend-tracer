import type { ProfileDirectives, ProfileRoleMap } from "../db.ts";
import { validateMapping } from "./profile.ts";

/** What the model receives to infer a mapping: headers and a small sample only. */
export interface MappingRequest {
  kind: string;
  headers: string[];
  sample: string[][];
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
  return `You map a bank statement export to a fixed set of columns.

File kind: ${request.kind}
Header row: ${request.headers.map((h) => JSON.stringify(h)).join(" | ")}
Sample rows:
${sample}

Return a mapping from these roles to the exact column header names above (or null when the file has no such column):
date, amount, amount_currency, account_amount, account_currency, description, category, balance, card, account, direction, debit, credit.

Also return directives:
- date_format: a token format using YYYY, MM, DD, HH, mm, ss (for example "DD.MM.YYYY HH:mm:ss").
- decimal: the decimal separator, usually "." or ",".
- thousands: the thousands separator, or "" when none.
- header_row: the 1-based row number of the header.
- sign: "signed" when the amount sign gives direction, "separate_columns" when debit and credit are separate columns, or "direction_column" when a column names the direction.
- prefer: "transaction" to prefer the transaction-currency amount, or "account" for the account-currency amount.

Use only the header names shown. Do not invent columns or expressions.`;
}

/** Validate and shape the model's JSON reply into a mapping result. */
export function parseMappingReply(raw: unknown): MappingResult {
  if (typeof raw !== "object" || raw === null) throw new Error("mapping reply is not an object");
  const record = raw as { bank?: unknown; roles?: unknown; directives?: unknown };
  const { roles, directives } = validateMapping(record);
  return { bank: typeof record.bank === "string" ? record.bank : null, roles, directives };
}

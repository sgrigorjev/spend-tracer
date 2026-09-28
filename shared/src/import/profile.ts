import type { ProfileDirectives, ProfileRoleMap, TransactionDirection } from "../db.ts";
import { toMinor } from "../money.ts";
import { normalizeHeader, rowFingerprint } from "./fingerprint.ts";

/** A statement row normalized to the shape the store and reconciliation use. */
export interface TransactionDraft {
  account: string | null;
  paid_at: string | null;
  expense_date: string;
  amount_minor: number | null;
  currency: string | null;
  account_amount_minor: number | null;
  account_currency: string | null;
  description: string;
  category: string | null;
  balance_minor: number | null;
  direction: TransactionDirection;
  card: string | null;
  fingerprint: string;
}

const ROLE_KEYS: Array<keyof ProfileRoleMap> = [
  "date",
  "amount",
  "amount_currency",
  "account_amount",
  "account_currency",
  "description",
  "category",
  "balance",
  "card",
  "account",
  "direction",
  "debit",
  "credit",
];

const DIRECTIVE_KEYS: Array<keyof ProfileDirectives> = [
  "date_format",
  "decimal",
  "thousands",
  "header_row",
  "delimiter",
  "encoding",
  "sign",
  "prefer",
];

/**
 * Validate a mapping produced by the model. Only known roles and known
 * directives are accepted, every value is a plain string, and a role value
 * that looks like an expression rather than a column name is rejected. This
 * keeps a learned profile equivalent to handwritten configuration.
 */
export function validateMapping(raw: { roles?: unknown; directives?: unknown }): {
  roles: ProfileRoleMap;
  directives: ProfileDirectives;
} {
  if (typeof raw.roles !== "object" || raw.roles === null) throw new Error("mapping has no roles");
  if (typeof raw.directives !== "object" || raw.directives === null) throw new Error("mapping has no directives");

  const roles: ProfileRoleMap = {};
  for (const [key, value] of Object.entries(raw.roles as Record<string, unknown>)) {
    if (!(ROLE_KEYS as string[]).includes(key)) throw new Error(`unknown role: ${key}`);
    if (value === null || value === undefined) continue;
    // The model sometimes writes the string "null" for an absent column.
    if (typeof value === "string" && ["", "null", "none", "n/a"].includes(value.trim().toLowerCase())) continue;
    if (typeof value !== "string" || value.length > 64 || /[=();{}]/.test(value)) {
      throw new Error(`invalid column reference for role ${key}`);
    }
    roles[key as keyof ProfileRoleMap] = value;
  }
  if (!roles.amount && !roles.debit) throw new Error("mapping has no amount source");
  if (!roles.date) throw new Error("mapping has no date column");

  const directives: ProfileDirectives = {};
  for (const [key, value] of Object.entries(raw.directives as Record<string, unknown>)) {
    if (!(DIRECTIVE_KEYS as string[]).includes(key)) throw new Error(`unknown directive: ${key}`);
    if (value === null || value === undefined) continue;
    const text = String(value);
    if (text.length > 64) throw new Error(`invalid directive: ${key}`);
    if (key === "sign" && !["signed", "separate_columns", "direction_column"].includes(text)) {
      throw new Error(`invalid sign directive: ${text}`);
    }
    if (key === "prefer" && !["transaction", "account"].includes(text)) {
      throw new Error(`invalid prefer directive: ${text}`);
    }
    (directives as Record<string, string>)[key] = text;
  }
  return { roles, directives };
}

/** Parse a number using the profile's separators. Returns null when unparsable. */
export function parseNumber(raw: string | undefined, directives: ProfileDirectives): number | null {
  if (raw == null) return null;
  let text = raw.replace(/[\s\u00a0']/g, "");
  if (text === "") return null;
  const thousands = directives.thousands ?? "";
  if (thousands && thousands !== "") text = text.split(thousands).join("");
  const decimal = directives.decimal ?? ".";
  if (decimal !== ".") text = text.replace(decimal, ".");
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

const TOKENS: Array<[string, string]> = [
  ["YYYY", "(\\d{4})"],
  ["MM", "(\\d{1,2})"],
  ["DD", "(\\d{1,2})"],
  ["HH", "(\\d{1,2})"],
  ["mm", "(\\d{1,2})"],
  ["ss", "(\\d{1,2})"],
];

/** Parse a date with an explicit token format, or a few common fallbacks. */
export function parseDate(raw: string | undefined, format?: string): string | null {
  if (raw == null || raw.trim() === "") return null;
  const value = raw.trim();
  if (format) {
    const parsed = parseWithTokens(value, format);
    if (parsed) return parsed;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
  if (iso) return assemble(iso[1], iso[2], iso[3], iso[4], iso[5], iso[6]);
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
  if (dmy) return assemble(dmy[3], dmy[2], dmy[1], dmy[4], dmy[5], dmy[6]);
  return null;
}

function parseWithTokens(value: string, format: string): string | null {
  let pattern = "";
  let i = 0;
  while (i < format.length) {
    const token = TOKENS.find(([name]) => format.startsWith(name, i));
    if (token) {
      pattern += token[1];
      i += token[0].length;
    } else {
      pattern += format[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  const match = new RegExp(`^${pattern}`).exec(value);
  if (!match) return null;
  const parts: Record<string, string> = {};
  i = 0;
  let group = 1;
  let cursor = 0;
  while (cursor < format.length) {
    const token = TOKENS.find(([name]) => format.startsWith(name, cursor));
    if (token) {
      parts[token[0]] = match[group++] ?? "";
      cursor += token[0].length;
    } else {
      cursor++;
    }
    i++;
  }
  return assemble(parts.YYYY, parts.MM, parts.DD, parts.HH, parts.mm, parts.ss);
}

function assemble(
  year: string | undefined,
  month: string | undefined,
  day: string | undefined,
  hour: string | undefined,
  minute: string | undefined,
  second: string | undefined,
): string | null {
  if (!year || !month || !day) return null;
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  const pad = (n: number) => String(n).padStart(2, "0");
  // Round-trip through Date so an impossible calendar date (30 February) is
  // rejected instead of stored and skewing grouping and the match window.
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  if (hour == null || minute == null) return date;
  const h = Number(hour);
  const mi = Number(minute);
  const s = Number(second ?? 0);
  if (h > 23 || mi > 59 || s > 59) return null;
  return `${date}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}

/** Whether a cell looks like a date or a number rather than a label. */
function looksLikeData(cell: string): boolean {
  const value = cell.trim();
  if (value === "") return false;
  return /^\d[\d\s\u00a0.,:'/-]*$/.test(value);
}

/**
 * Find the header row among the first few rows. Bank exports often put a title
 * line above the headers whose text changes per export (the covered period),
 * so the fingerprint is taken from the detected header row, not from row one.
 */
export function detectHeaderRow(grid: string[][]): number {
  const limit = Math.min(grid.length, 6);
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < limit; i++) {
    const cells = (grid[i] ?? []).map((cell) => cell.trim()).filter((cell) => cell !== "");
    if (cells.length === 0) continue;
    const text = cells.filter((cell) => /[^\d\s.,:/-]/.test(cell)).length;
    const data = cells.filter(looksLikeData).length;
    const score = text * 2 - data * 3 + cells.length * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Read one role's cell value from a row using a normalized header index. */
function cellFor(row: string[], index: Map<string, number>, column: string | null | undefined): string | undefined {
  if (!column) return undefined;
  const at = index.get(normalizeHeader(column));
  if (at === undefined) return undefined;
  const value = row[at];
  return value === undefined || value === "" ? undefined : value;
}

const TRANSFER_PATTERNS = [
  "на свою картку",
  "зі своєї картки",
  "переказ",
  "перерахування",
  "own card",
  "transfer",
];

/**
 * Apply a profile to a statement grid, producing one draft per data row.
 * The transaction-currency amount is authoritative when both are present; the
 * account-currency amount is kept alongside it. Amounts are stored as positive
 * minor units with the direction carried separately.
 */
export function applyProfile(
  grid: string[][],
  profile: { roles: ProfileRoleMap; directives: ProfileDirectives },
): TransactionDraft[] {
  const { roles, directives } = profile;
  if (grid.length === 0) return [];
  const headerRow = directives.header_row ? Math.max(1, directives.header_row) - 1 : detectHeaderRow(grid);
  const headers = grid[headerRow] ?? [];
  const index = new Map<string, number>();
  headers.forEach((header, at) => index.set(normalizeHeader(header), at));

  const drafts: TransactionDraft[] = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((cell) => cell.trim() === "")) continue;

    const dateRaw = cellFor(row, index, roles.date);
    const paidAt = parseDate(dateRaw, directives.date_format);
    if (!paidAt) throw new Error(`row ${r + 1}: unparsable date ${JSON.stringify(dateRaw ?? "")}`);

    const txAmount = parseNumber(cellFor(row, index, roles.amount), directives);
    const txCurrency = cellFor(row, index, roles.amount_currency)?.toUpperCase() ?? null;
    const accAmount = parseNumber(cellFor(row, index, roles.account_amount), directives);
    const accCurrency = cellFor(row, index, roles.account_currency)?.toUpperCase() ?? null;

    let amount = txAmount;
    let currency = txCurrency;
    if (directives.prefer === "account" && accAmount != null) {
      amount = accAmount;
      currency = accCurrency;
    }
    if (amount == null) {
      amount = accAmount;
      currency = accCurrency;
    }
    if (amount == null) {
      // Profiles that only have separate debit and credit columns.
      const debit = parseNumber(cellFor(row, index, roles.debit), directives);
      const credit = parseNumber(cellFor(row, index, roles.credit), directives);
      if (debit != null && debit !== 0) amount = -Math.abs(debit);
      else if (credit != null && credit !== 0) amount = Math.abs(credit);
    }
    if (amount == null) throw new Error(`row ${r + 1}: unparsable amount`);

    const direction = resolveDirection(row, index, roles, directives, amount, accAmount);
    const balanceRaw = parseNumber(cellFor(row, index, roles.balance), directives);

    const account = cellFor(row, index, roles.account) ?? cellFor(row, index, roles.card) ?? null;
    const card = cellFor(row, index, roles.card) ?? null;
    const description = cellFor(row, index, roles.description) ?? "";
    const category = cellFor(row, index, roles.category) ?? null;
    const isTransfer = TRANSFER_PATTERNS.some((pattern) => description.toLowerCase().includes(pattern));

    // Amounts keep their sign, because the running balance moves by the signed
    // account-currency amount; the direction field carries the classification.
    const draft: TransactionDraft = {
      account,
      paid_at: paidAt,
      expense_date: paidAt.slice(0, 10),
      amount_minor: toMinor(amount, currency ?? "EUR"),
      currency,
      account_amount_minor: accAmount == null ? null : toMinor(accAmount, accCurrency ?? currency ?? "EUR"),
      account_currency: accCurrency,
      description,
      category,
      balance_minor: balanceRaw == null ? null : toMinor(balanceRaw, accCurrency ?? currency ?? "EUR"),
      direction: isTransfer ? "transfer" : direction,
      card,
      fingerprint: "",
    };
    draft.fingerprint = rowFingerprint({
      account: draft.account,
      paidAt: draft.paid_at,
      amountMinor: draft.amount_minor,
      currency: draft.currency,
      description: draft.description,
      balanceMinor: draft.balance_minor,
      sequence: draft.balance_minor === null ? r : null,
    });
    drafts.push(draft);
  }
  return drafts;
}

function resolveDirection(
  row: string[],
  index: Map<string, number>,
  roles: ProfileRoleMap,
  directives: ProfileDirectives,
  amount: number,
  accountAmount: number | null,
): TransactionDirection {
  const sign = directives.sign ?? (roles.debit || roles.credit ? "separate_columns" : "signed");

  if (sign === "separate_columns") {
    const debit = parseNumber(cellFor(row, index, roles.debit), directives);
    if (debit != null && debit !== 0) return "outflow";
    return "inflow";
  }
  if (sign === "direction_column" && roles.direction) {
    const value = (cellFor(row, index, roles.direction) ?? "").toLowerCase();
    if (/(debit|out|списан|витрат|payment)/.test(value)) return "outflow";
    return "inflow";
  }
  // With a signed amount, the transaction-currency column is often unsigned
  // (the card statement keeps the sign on the account-currency debit only), so
  // a negative value in either column marks an outflow.
  const negative = amount < 0 || (accountAmount !== null && accountAmount < 0);
  return negative ? "outflow" : "inflow";
}

const ISO_CURRENCIES: Set<string> | null =
  typeof Intl.supportedValuesOf === "function" ? new Set(Intl.supportedValuesOf("currency")) : null;

/** Check a currency against the platform ISO-4217 list, if it is available. */
export function isIsoCurrency(currency: string | null): boolean {
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return false;
  return ISO_CURRENCIES ? ISO_CURRENCIES.has(currency) : true;
}

/** Result of the invariant check applied to a parsed statement. */
export type IntegrityResult = { ok: true } | { ok: false; reason: string };

/**
 * Verify a parsed statement before it is trusted: every row has a date and an
 * amount, every currency is ISO-4217, and, where a balance is present,
 * consecutive balances of the same account reconcile with the row amounts.
 * A failure keeps a freshly learned profile in draft and refuses the import.
 */
export function checkIntegrity(drafts: TransactionDraft[]): IntegrityResult {
  if (drafts.length === 0) return { ok: false, reason: "no rows parsed" };
  for (const draft of drafts) {
    if (draft.amount_minor === null) return { ok: false, reason: "a row has no amount" };
    if (!draft.expense_date) return { ok: false, reason: "a row has no date" };
    if (draft.currency && !isIsoCurrency(draft.currency)) {
      return { ok: false, reason: `unknown currency ${draft.currency}` };
    }
  }

  // Statements list the newest row first, so each row's balance is the next
  // (older) row's balance plus its own signed amount.
  const previous = new Map<string, { balance: number; delta: number }>();
  for (const draft of drafts) {
    if (draft.balance_minor === null) continue;
    const key = draft.account ?? "";
    const newer = previous.get(key);
    if (newer && newer.balance - newer.delta !== draft.balance_minor) {
      return { ok: false, reason: `balance does not reconcile for account ${key || "unknown"}` };
    }
    // The running balance is in the account currency, so it moves by the
    // signed account-currency amount, not by the transaction-currency amount.
    const delta = draft.account_amount_minor ?? draft.amount_minor ?? 0;
    previous.set(key, { balance: draft.balance_minor, delta });
  }
  return { ok: true };
}


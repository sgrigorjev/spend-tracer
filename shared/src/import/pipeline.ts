import { readFile } from "node:fs/promises";
import type {
  ImportProfileStatus,
  ProfileRow,
  Store,
  TransactionDirection,
  UserRow,
} from "../db.ts";
import { fromMinor } from "../money.ts";
import { buildExpenseInsert } from "../expenseInput.ts";
import { mapCategoryToKnown } from "../categories.ts";
import { detectKind, type FileKind } from "./detect.ts";
import { readCsv } from "./csv.ts";
import { readXlsx } from "./xlsx.ts";
import { formatFingerprint } from "./fingerprint.ts";
import { applyProfile, checkIntegrity, detectHeaderRow, type IntegrityResult, type TransactionDraft } from "./profile.ts";
import type { MappingGenerator } from "./learn.ts";
import { chooseBand, rankCandidates, DATE_WINDOW_DAYS, type ScoredCandidate } from "./reconcile.ts";

/** Rows beyond this in one statement are refused, to bound memory and cost. */
export const MAX_STATEMENT_ROWS = 20000;
/** Statement files larger than this are refused before parsing. */
export const MAX_STATEMENT_BYTES = 25 * 1024 * 1024;

/** Extract transactions from a PDF or image statement. Injected by the host. */
export interface DocumentExtractor {
  (request: { kind: "pdf" | "image"; filePath: string }): Promise<TransactionDraft[]>;
}

/** The preview shown before a freshly learned profile is applied to later files. */
export interface ProfilePreview {
  profile: ProfileRow;
  bank: string | null;
  rows: TransactionDraft[];
  integrity: IntegrityResult;
}

/** Called once for a new format; returns true to accept the profile. */
export type ProfileConfirmer = (preview: ProfilePreview) => Promise<boolean>;

/** One uncertain match offered to the user, with its ranked candidates. */
export interface DecisionInput {
  draft: TransactionDraft;
  transactionId: number;
  ranked: ScoredCandidate[];
}

/** What the user chose for an uncertain match. */
export type DecisionOutcome =
  | { action: "merge"; expenseId: number }
  | { action: "separate" }
  | { action: "ignore" };

export type DecisionHandler = (input: DecisionInput) => Promise<DecisionOutcome>;

/** Host-provided model and user-interaction hooks. */
export interface ImportDeps {
  generateMapping: MappingGenerator;
  extractDocument: DocumentExtractor;
  confirmProfile: ProfileConfirmer;
  decide: DecisionHandler;
}

/** Result of one import run. */
export interface ImportSummary {
  statementId: number;
  bank: string | null;
  kind: FileKind;
  profile: "reused" | "learned" | "none";
  parsed: number;
  stored: number;
  skipped: number;
  linked: number;
  created: number;
  ignored: number;
  asked: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDate(date: string, days: number): string {
  const base = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

function minMaxDate(drafts: TransactionDraft[]): { from: string | null; to: string | null } {
  if (drafts.length === 0) return { from: null, to: null };
  const dates = drafts.map((draft) => draft.expense_date).filter((date) => date !== "");
  if (dates.length === 0) return { from: null, to: null };
  dates.sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

/** Refuse to touch an expense that is not the importer's or their family's. */
function assertLinkAllowed(store: Store, importer: UserRow, expenseId: number): void {
  const expense = store.findExpenseById(expenseId);
  if (!expense) throw new Error("expense not found");
  if (!store.visibleUserIds(importer.id).includes(expense.user_id)) {
    throw new Error("refusing to link an expense outside the family");
  }
}

/** Attach an existing expense to a transaction, recording who took part. */
function linkTransaction(store: Store, importer: UserRow, transactionId: number, expenseId: number): void {
  assertLinkAllowed(store, importer, expenseId);
  store.transaction(() => {
    store.addParticipant({ expense_id: expenseId, user_id: importer.id, role: "payer", origin: "import", confidence: 1 });
    store.addParticipant({
      expense_id: expenseId,
      user_id: importer.id,
      role: "confirmer",
      origin: "import",
      confidence: 1,
    });
    store.setTransactionResolution(transactionId, { state: "linked", expense_id: expenseId });
    store.appendExpenseEvent({
      expense_id: expenseId,
      kind: "linked",
      detail: "matched statement transaction",
      transaction_id: transactionId,
      actor_user_id: importer.id,
    });
  });
}

/** Undo a link, detaching the transaction and removing the participants it added. */
export function unlinkTransaction(store: Store, userId: number, transactionId: number, expenseId: number): void {
  const importer = store.findUserById(userId);
  if (!importer) throw new Error("user not found");
  assertLinkAllowed(store, importer, expenseId);
  store.transaction(() => {
    store.removeParticipant(expenseId, userId, "payer", "import");
    store.removeParticipant(expenseId, userId, "confirmer", "import");
    store.setTransactionResolution(transactionId, { state: "unmatched", expense_id: null });
    store.appendExpenseEvent({
      expense_id: expenseId,
      kind: "unlinked",
      detail: "unlinked statement transaction",
      transaction_id: transactionId,
      actor_user_id: userId,
    });
  });
}

/** Create a confirmed expense from a matched transaction, owned by the importer. */
async function createExpenseFromTransaction(
  store: Store,
  importer: UserRow,
  transactionId: number,
  draft: TransactionDraft,
  baseCurrency: string,
): Promise<number> {
  if (draft.amount_minor === null || !draft.currency) throw new Error("transaction has no amount to store");
  const insert = await buildExpenseInsert(
    store,
    {
      amount: fromMinor(Math.abs(draft.amount_minor), draft.currency),
      currency: draft.currency,
      category: mapCategoryToKnown(draft.category ?? draft.description),
      description: draft.description || draft.card || "bank transaction",
      paid_at: draft.paid_at,
      confidence: 1,
    },
    importer,
    new Date().toISOString(),
    "import",
    baseCurrency,
  );
  return store.transaction(() => {
    const expenseId = store.appendExpense({ ...insert, status: "confirmed" });
    store.addParticipant({ expense_id: expenseId, user_id: importer.id, role: "payer", origin: "import", confidence: 1 });
    store.addParticipant({
      expense_id: expenseId,
      user_id: importer.id,
      role: "confirmer",
      origin: "import",
      confidence: 1,
    });
    store.setTransactionResolution(transactionId, { state: "created", expense_id: expenseId });
    store.appendExpenseEvent({
      expense_id: expenseId,
      kind: "enriched",
      detail: "created from statement transaction",
      transaction_id: transactionId,
      actor_user_id: importer.id,
    });
    return expenseId;
  });
}

/**
 * Import one statement file for a user: resolve or learn a profile, parse rows,
 * store the statement idempotently, then reconcile outflows against expenses
 * already recorded within the user's family.
 */
export async function importStatement(
  store: Store,
  user: UserRow,
  options: { filePath: string; baseCurrency: string },
  deps: ImportDeps,
): Promise<ImportSummary> {
  const bytes = await readFile(options.filePath);
  if (bytes.length === 0) throw new Error("statement file is empty");
  if (bytes.length > MAX_STATEMENT_BYTES) throw new Error("statement file is too large");
  const kind = detectKind(bytes);

  let drafts: TransactionDraft[];
  let bank: string | null = null;
  let profileState: ImportSummary["profile"] = "none";

  if (kind === "csv" || kind === "xlsx") {
    const grid = kind === "csv" ? readCsv(bytes) : readXlsx(bytes);
    if (grid.length === 0) throw new Error("statement file is empty");
    if (grid.length > MAX_STATEMENT_ROWS) throw new Error("statement has too many rows");
    const headerRow = detectHeaderRow(grid);
    const headers = grid[headerRow] ?? [];
    const sample = grid.slice(headerRow + 1, headerRow + 6);
    const fingerprint = formatFingerprint(kind, headers, sample);
    const existing = store.findProfile(user.id, fingerprint);

    if (existing && existing.status === "draft") {
      throw new Error("this format has a profile awaiting confirmation");
    }
    if (existing) {
      drafts = applyProfile(grid, existing);
      const integrity = checkIntegrity(drafts);
      if (!integrity.ok) throw new Error(`statement failed verification: ${integrity.reason}`);
      store.markProfileUsed(user.id, fingerprint);
      bank = existing.bank;
      profileState = "reused";
    } else {
      const mapping = await deps.generateMapping({ kind, headers, sample });
      const directives = { ...mapping.directives, header_row: headerRow + 1 };
      store.saveProfile({
        user_id: user.id,
        fingerprint,
        bank: mapping.bank,
        kind,
        roles: mapping.roles,
        directives,
        status: "draft" satisfies ImportProfileStatus,
      });
      drafts = applyProfile(grid, { roles: mapping.roles, directives });
      const integrity = checkIntegrity(drafts);
      if (!integrity.ok) throw new Error(`learned profile failed verification: ${integrity.reason}`);
      const profile = store.findProfile(user.id, fingerprint)!;
      const confirmed = await deps.confirmProfile({ profile, bank: mapping.bank, rows: drafts, integrity });
      if (!confirmed) throw new Error("profile rejected");
      store.setProfileStatus(user.id, fingerprint, "verified");
      bank = mapping.bank;
      profileState = "learned";
    }
  } else {
    drafts = await deps.extractDocument({ kind, filePath: options.filePath });
    const integrity = checkIntegrity(drafts);
    if (!integrity.ok) throw new Error(`document failed verification: ${integrity.reason}`);
  }

  const range = minMaxDate(drafts);
  const statementId = store.appendStatement({
    user_id: user.id,
    bank,
    format: kind,
    file_name: options.filePath.split("/").pop() ?? options.filePath,
    period_from: range.from,
    period_to: range.to,
  });

  const summary: ImportSummary = {
    statementId,
    bank,
    kind,
    profile: profileState,
    parsed: drafts.length,
    stored: 0,
    skipped: 0,
    linked: 0,
    created: 0,
    ignored: 0,
    asked: 0,
  };

  for (const draft of drafts) {
    const transactionId = store.appendTransaction({
      statement_id: statementId,
      user_id: user.id,
      account: draft.account,
      paid_at: draft.paid_at,
      expense_date: draft.expense_date,
      amount_minor: draft.amount_minor,
      currency: draft.currency,
      account_amount_minor: draft.account_amount_minor,
      account_currency: draft.account_currency,
      description: draft.description,
      category: draft.category,
      balance_minor: draft.balance_minor,
      direction: draft.direction,
      card: draft.card,
      fingerprint: draft.fingerprint,
    });
    if (transactionId === null) {
      summary.skipped++;
      continue;
    }
    summary.stored++;

    if (draft.direction !== "outflow" || draft.amount_minor === null || !draft.currency) {
      store.setTransactionResolution(transactionId, { state: "ignored", expense_id: null });
      summary.ignored++;
      continue;
    }

    const memberIds = store.visibleUserIds(user.id);
    const candidates = store.findMatchCandidates(
      memberIds,
      Math.abs(draft.amount_minor),
      draft.currency,
      shiftDate(draft.expense_date, -DATE_WINDOW_DAYS),
      shiftDate(draft.expense_date, DATE_WINDOW_DAYS),
    );
    const ranked = rankCandidates(draft, candidates);
    const band = chooseBand(ranked);

    if (band === "high") {
      linkTransaction(store, user, transactionId, ranked[0].expense.id);
      summary.linked++;
    } else if (band === "middle") {
      summary.asked++;
      const outcome = await deps.decide({ draft, transactionId, ranked });
      if (outcome.action === "merge") {
        linkTransaction(store, user, transactionId, outcome.expenseId);
        summary.linked++;
      } else if (outcome.action === "separate") {
        await createExpenseFromTransaction(store, user, transactionId, draft, options.baseCurrency);
        summary.created++;
      } else {
        store.setTransactionResolution(transactionId, { state: "ignored", expense_id: null });
        summary.ignored++;
      }
    } else {
      await createExpenseFromTransaction(store, user, transactionId, draft, options.baseCurrency);
      summary.created++;
    }
  }

  return summary;
}

/** Direction values a host may reuse when mapping a parsed row. */
export type { TransactionDirection };

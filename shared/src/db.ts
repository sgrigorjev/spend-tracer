import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type ExpenseSource = "text" | "photo" | "voice" | "import";
export type ExpenseStatus = "pending" | "confirmed" | "rejected";
export type PaidAtPrecision = "date" | "minute";
export type FamilyRole = "owner" | "member";
export type FamilyMemberStatus = "invited" | "active";
/** How a user is involved in an expense. */
export type ExpenseParticipantRole = "recorder" | "payer" | "confirmer";
/** Which path attached a participant: the bot, an import, or a manual action. */
export type ParticipantOrigin = "bot" | "import" | "manual";
/** A learned import profile is draft until the user confirms it. */
export type ImportProfileStatus = "draft" | "verified";
/** Money direction of a statement row. Only outflows become expenses. */
export type TransactionDirection = "outflow" | "inflow" | "transfer";
/** What reconciliation decided for an imported transaction. */
export type TransactionState = "unmatched" | "linked" | "created" | "ignored";
/** Kinds of audit events recorded against an expense. */
export type ExpenseEventKind =
  | "created"
  | "linked"
  | "unlinked"
  | "enriched"
  | "participant_added"
  | "participant_removed";

/** One row in the users table. */
export interface UserRow {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
  telegram_user_id: number | null;
  display_currency: string;
  display_timezone: string;
  created_at: string;
  last_login: string;
}

/** Input for resolving (or creating) a user from an OAuth identity. */
export interface ResolveUserInput {
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
  subject: string;
}

/** Fields a user may change about how expenses are displayed. */
export interface UserSettingsUpdate {
  display_currency?: string;
  display_timezone?: string;
}

/** One row in the expenses table. */
export interface ExpenseRow {
  id: number;
  user_id: number;
  amount_minor: number | null;
  currency: string | null;
  base_amount_minor: number | null;
  base_currency: string;
  fx_rate: number | null;
  fx_rate_date: string | null;
  category: string | null;
  description: string;
  paid_at: string | null;
  paid_at_precision: PaidAtPrecision;
  expense_date: string;
  source: ExpenseSource;
  confidence: number;
  status: ExpenseStatus;
  created_at: string;
  updated_at: string;
}

/** Fields supplied when inserting an expense; timestamps are set by the store. */
export type ExpenseInsert = Omit<ExpenseRow, "id" | "created_at" | "updated_at">;

/** Fields editable after insertion. Status changes go through setExpenseStatus. */
export type ExpenseUpdate = Pick<
  ExpenseRow,
  | "amount_minor"
  | "currency"
  | "base_amount_minor"
  | "base_currency"
  | "fx_rate"
  | "fx_rate_date"
  | "category"
  | "description"
  | "paid_at"
  | "paid_at_precision"
  | "expense_date"
  | "confidence"
>;

/** A raw message log entry, always tied to a linked user. */
export interface MessageRecord {
  user_id: number;
  text: string;
  created_at: string;
}

/** One row in the families table. */
export interface FamilyRow {
  id: number;
  name: string | null;
  owner_id: number;
  created_at: string;
}

/** One row in the family_members table. */
export interface FamilyMemberRow {
  id: number;
  family_id: number;
  user_id: number;
  role: FamilyRole;
  status: FamilyMemberStatus;
  invited_by: number | null;
  created_at: string;
  joined_at: string | null;
}

/** A rate returned by the exchange-rate lookup. */
export interface RateLookup {
  rate: number;
  date: string;
  source: string;
}

/** Result of redeeming a Telegram link token. */
export type RedeemResult =
  | { ok: true; userId: number }
  | { ok: false; reason: "unknown" | "expired" | "used" | "telegram_taken" };

/** Result of a family mutation, carrying a reason when it is refused. */
export type FamilyResult =
  | { ok: true; familyId?: number }
  | { ok: false; reason: string };

/** Confirmed spend and non-rejected count for one day. */
export interface DailySpendRow {
  date: string;
  total_minor: number;
  count: number;
}

/** Confirmed spend for one category. */
export interface CategorySpendRow {
  category: string;
  total_minor: number;
}

/** Aggregates for a dashboard period. */
export interface ExpenseSummary {
  confirmed_total_minor: number;
  confirmed_count: number;
  pending_total_minor: number;
  pending_count: number;
  by_day: DailySpendRow[];
  by_category: CategorySpendRow[];
}

/** One page of expenses plus the total number of matching rows. */
export interface ExpensePage {
  items: ExpenseRow[];
  total: number;
}

/** Confirmed spend for one weekday, 0 = Sunday through 6 = Saturday. */
export interface WeekdaySpendRow {
  weekday: number;
  total_minor: number;
}

/** Raised when a scope names a user outside the viewer's family. */
export class ScopeForbiddenError extends Error {
  constructor() {
    super("scope is outside the viewer's family");
    this.name = "ScopeForbiddenError";
  }
}

/** Fields supplied when storing an imported statement. */
export interface StatementInsert {
  user_id: number;
  bank: string | null;
  format: string;
  file_name: string;
  period_from: string | null;
  period_to: string | null;
}

/** One row in the bank_statements table. */
export interface StatementRow extends StatementInsert {
  id: number;
  created_at: string;
}

/** Fields supplied when storing a parsed statement row. */
export interface TransactionInsert {
  statement_id: number;
  user_id: number;
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

/** One row in the bank_transactions table. */
export interface TransactionRow extends TransactionInsert {
  id: number;
  expense_id: number | null;
  state: TransactionState;
  created_at: string;
}

/** Outcome of resolving a transaction during reconciliation. */
export interface TransactionResolution {
  state: TransactionState;
  expense_id: number | null;
}

/** Semantic roles an import profile maps to column or field names. */
export interface ProfileRoleMap {
  date?: string | null;
  amount?: string | null;
  amount_currency?: string | null;
  account_amount?: string | null;
  account_currency?: string | null;
  description?: string | null;
  category?: string | null;
  balance?: string | null;
  card?: string | null;
  account?: string | null;
  direction?: string | null;
  debit?: string | null;
  credit?: string | null;
}

/** How a profile reads dates, numbers and the direction of money. */
export interface ProfileDirectives {
  date_format?: string;
  decimal?: string;
  thousands?: string;
  header_row?: number;
  delimiter?: string;
  encoding?: string;
  sign?: "signed" | "separate_columns" | "direction_column";
  prefer?: "transaction" | "account";
}

/** Fields supplied when storing an import profile. */
export interface ProfileInsert {
  user_id: number;
  fingerprint: string;
  bank: string | null;
  kind: string;
  roles: ProfileRoleMap;
  directives: ProfileDirectives;
  status: ImportProfileStatus;
}

/** One row in the import_profiles table. */
export interface ProfileRow extends ProfileInsert {
  id: number;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
}

/** Fields supplied when attaching a participant to an expense. */
export interface ParticipantInsert {
  expense_id: number;
  user_id: number;
  role: ExpenseParticipantRole;
  origin: ParticipantOrigin;
  confidence: number;
}

/** One row in the expense_participants table. */
export interface ParticipantRow extends ParticipantInsert {
  id: number;
  created_at: string;
}

/** Fields supplied when recording an expense event. */
export interface ExpenseEventInsert {
  expense_id: number;
  kind: ExpenseEventKind;
  detail: string | null;
  transaction_id: number | null;
  actor_user_id: number | null;
}

/** One row in the expense_events table. */
export interface ExpenseEventRow extends ExpenseEventInsert {
  id: number;
  created_at: string;
}

export interface Store {
  readonly path: string;
  // users
  resolveUser(input: ResolveUserInput): UserRow;
  findUserById(id: number): UserRow | undefined;
  findUserByEmail(email: string): UserRow | undefined;
  findUserByTelegramId(telegramId: number): UserRow | undefined;
  updateUserSettings(userId: number, fields: UserSettingsUpdate): void;
  // expenses
  appendExpense(row: ExpenseInsert): number;
  findExpenseById(id: number): ExpenseRow | undefined;
  listExpensesMissingBase(): ExpenseRow[];
  /**
   * Fill a base equivalent only when the row is unchanged since it was read and
   * still has none, so a concurrent edit is not overwritten. Returns true when
   * the update applied.
   */
  backfillExpenseBase(
    id: number,
    expected: { amount_minor: number | null; currency: string | null; expense_date: string },
    base: { base_amount_minor: number; base_currency: string; fx_rate: number; fx_rate_date: string },
  ): boolean;
  setExpenseStatus(id: number, status: ExpenseStatus): void;
  updateExpense(id: number, fields: Partial<ExpenseUpdate>): void;
  expenseSummary(userId: number, from: string, to: string): ExpenseSummary;
  listExpenses(userId: number, from: string, to: string, limit: number, offset: number): ExpensePage;
  spendByWeekday(userId: number, from: string, to: string): WeekdaySpendRow[];
  // participant-aware reads
  expenseSummaryForUser(viewerId: number, from: string, to: string): ExpenseSummary;
  listExpensesForUser(viewerId: number, from: string, to: string, limit: number, offset: number): ExpensePage;
  spendByWeekdayForUser(viewerId: number, from: string, to: string): WeekdaySpendRow[];
  findMatchCandidates(
    memberIds: number[],
    amountMinor: number,
    currency: string,
    fromDate: string,
    toDate: string,
  ): ExpenseRow[];
  // messages
  appendMessage(message: MessageRecord): void;
  // telegram linking
  // ttlSeconds is the token lifetime and is expected to be positive; a
  // non-positive value mints an immediately expired token (used by tests).
  createLinkToken(userId: number, ttlSeconds: number): { token: string; expiresAt: string };
  redeemLinkToken(token: string, telegramUserId: number): RedeemResult;
  unlinkTelegram(userId: number): void;
  // families
  createFamily(ownerId: number, name: string | null): FamilyResult;
  getFamilyForUser(userId: number): { family: FamilyRow; membership: FamilyMemberRow } | undefined;
  listFamilyMembers(familyId: number): FamilyMemberRow[];
  inviteByEmail(familyId: number, inviterId: number, email: string): FamilyResult;
  listPendingInvitations(userId: number): Array<{ family: FamilyRow; membership: FamilyMemberRow }>;
  acceptInvitation(userId: number, familyId: number): FamilyResult;
  declineInvitation(userId: number, familyId: number): FamilyResult;
  leaveFamily(userId: number): FamilyResult;
  removeMember(ownerId: number, targetUserId: number): FamilyResult;
  visibleUserIds(viewerId: number): number[];
  resolveScope(viewerId: number, scope: string): number[];
  // bank import
  appendStatement(row: StatementInsert): number;
  appendTransaction(row: TransactionInsert): number | null;
  findTransactionByFingerprint(userId: number, fingerprint: string): TransactionRow | undefined;
  /** Card, account and bank carried by the statement a linked expense came from. */
  findLinkedTransaction(expenseId: number): { card: string | null; account: string | null; bank: string | null } | undefined;
  listTransactions(statementId: number): TransactionRow[];
  setTransactionResolution(transactionId: number, resolution: TransactionResolution): void;
  saveProfile(row: ProfileInsert): number;
  findProfile(userId: number, fingerprint: string): ProfileRow | undefined;
  listProfiles(userId: number): ProfileRow[];
  setProfileStatus(userId: number, fingerprint: string, status: ImportProfileStatus): void;
  deleteProfile(userId: number, fingerprint: string): void;
  markProfileUsed(userId: number, fingerprint: string): void;
  // participants and events
  addParticipant(row: ParticipantInsert): void;
  removeParticipant(
    expenseId: number,
    userId: number,
    role: ExpenseParticipantRole,
    origin: ParticipantOrigin,
  ): void;
  listParticipants(expenseId: number): ParticipantRow[];
  appendExpenseEvent(row: ExpenseEventInsert): void;
  listExpenseEvents(expenseId: number): ExpenseEventRow[];
  /** Run several writes as one transaction; nests with SAVEPOINT. */
  transaction<T>(fn: () => T): T;
  // exchange rates
  getRateForDate(base: string, quote: string, requestedDate: string): RateLookup | undefined;
  getNearestRate(base: string, quote: string, requestedDate: string): RateLookup | undefined;
  saveRate(
    base: string,
    quote: string,
    requestedDate: string,
    rate: number,
    sourceDate: string,
    source: string,
  ): void;
  close(): void;
}

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT NOT NULL UNIQUE,
  name              TEXT,
  avatar            TEXT,
  telegram_user_id  INTEGER UNIQUE,
  display_currency  TEXT NOT NULL DEFAULT 'EUR',
  display_timezone  TEXT NOT NULL DEFAULT 'Europe/Madrid',
  created_at        TEXT NOT NULL,
  last_login        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identities (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  provider  TEXT NOT NULL,
  subject   TEXT NOT NULL,
  UNIQUE (provider, subject)
);

CREATE TABLE IF NOT EXISTS expenses (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  amount_minor      INTEGER,
  currency          TEXT,
  base_amount_minor INTEGER,
  base_currency     TEXT NOT NULL DEFAULT 'EUR',
  fx_rate           REAL,
  fx_rate_date      TEXT,
  category          TEXT,
  description       TEXT NOT NULL,
  paid_at           TEXT,
  paid_at_precision TEXT NOT NULL,
  expense_date      TEXT NOT NULL,
  source            TEXT NOT NULL CHECK (source IN ('text', 'photo', 'voice', 'import')),
  confidence        REAL NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date      ON expenses (expense_date);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_tokens (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  base_currency  TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  requested_date TEXT NOT NULL,
  rate           REAL NOT NULL,
  source_date    TEXT NOT NULL,
  source         TEXT NOT NULL,
  UNIQUE (base_currency, quote_currency, requested_date)
);

CREATE TABLE IF NOT EXISTS families (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  owner_id   INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  INTEGER NOT NULL REFERENCES families(id),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  status     TEXT NOT NULL CHECK (status IN ('invited', 'active')),
  invited_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  joined_at  TEXT,
  UNIQUE (family_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_members_active
  ON family_members (user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bank_statements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  bank        TEXT,
  format      TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  period_from TEXT,
  period_to   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  statement_id         INTEGER NOT NULL REFERENCES bank_statements(id),
  user_id              INTEGER NOT NULL REFERENCES users(id),
  account              TEXT,
  paid_at              TEXT,
  expense_date         TEXT NOT NULL,
  amount_minor         INTEGER,
  currency             TEXT,
  account_amount_minor INTEGER,
  account_currency     TEXT,
  description          TEXT NOT NULL,
  category             TEXT,
  balance_minor        INTEGER,
  direction            TEXT NOT NULL CHECK (direction IN ('outflow', 'inflow', 'transfer')),
  card                 TEXT,
  fingerprint          TEXT NOT NULL,
  expense_id           INTEGER REFERENCES expenses(id),
  state                TEXT NOT NULL DEFAULT 'unmatched'
                       CHECK (state IN ('unmatched', 'linked', 'created', 'ignored')),
  created_at           TEXT NOT NULL,
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_state ON bank_transactions (user_id, state);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_statement   ON bank_transactions (statement_id);

CREATE TABLE IF NOT EXISTS import_profiles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  fingerprint  TEXT NOT NULL,
  bank         TEXT,
  kind         TEXT NOT NULL,
  roles        TEXT NOT NULL,
  directives   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified')),
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  use_count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS expense_participants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL REFERENCES expenses(id),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  role       TEXT NOT NULL CHECK (role IN ('recorder', 'payer', 'confirmer')),
  origin     TEXT NOT NULL CHECK (origin IN ('bot', 'import', 'manual')),
  confidence REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (expense_id, user_id, role, origin)
);

CREATE INDEX IF NOT EXISTS idx_expense_participants_expense ON expense_participants (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_participants_user    ON expense_participants (user_id);

CREATE TABLE IF NOT EXISTS expense_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id    INTEGER NOT NULL REFERENCES expenses(id),
  kind          TEXT NOT NULL,
  detail        TEXT,
  transaction_id INTEGER REFERENCES bank_transactions(id),
  actor_user_id INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expense_events_expense ON expense_events (expense_id);
`;

/** Columns of ExpenseUpdate in a stable order, mapped to their SQL names. */
const UPDATE_COLUMNS: Record<keyof ExpenseUpdate, string> = {
  amount_minor: "amount_minor",
  currency: "currency",
  base_amount_minor: "base_amount_minor",
  base_currency: "base_currency",
  fx_rate: "fx_rate",
  fx_rate_date: "fx_rate_date",
  category: "category",
  description: "description",
  paid_at: "paid_at",
  paid_at_precision: "paid_at_precision",
  expense_date: "expense_date",
  confidence: "confidence",
};

const DEFAULT_CURRENCY = "EUR";
const DEFAULT_TIMEZONE = "Europe/Madrid";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Open (creating if needed) the shared SQLite database at `dbPath` and return a
 * store for every table the bot and the API use. A rollback journal plus a busy
 * timeout lets the two services share the file without lock errors, and keeps
 * it readable by standard tools over WSL and network paths, which WAL is not.
 */
export function createStore(dbPath: string): Store {
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = DELETE");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(CREATE_TABLES);

  const selectIdentity = db.prepare("SELECT user_id FROM identities WHERE provider = ? AND subject = ?");
  const selectUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
  const selectUserById = db.prepare("SELECT * FROM users WHERE id = ?");
  const selectUserByTelegram = db.prepare("SELECT * FROM users WHERE telegram_user_id = ?");
  const insertUser = db.prepare(
    "INSERT INTO users (email, name, avatar, display_currency, display_timezone, created_at, last_login) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertIdentity = db.prepare("INSERT INTO identities (user_id, provider, subject) VALUES (?, ?, ?)");
  const updateLastLogin = db.prepare("UPDATE users SET last_login = ? WHERE id = ?");
  const updateTelegram = db.prepare("UPDATE users SET telegram_user_id = ? WHERE id = ?");

  const insertExpense = db.prepare(`
    INSERT INTO expenses (user_id, amount_minor, currency, base_amount_minor, base_currency, fx_rate, fx_rate_date,
                          category, description, paid_at, paid_at_precision, expense_date, source, confidence,
                          status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectExpenseById = db.prepare("SELECT * FROM expenses WHERE id = ?");
  const selectExpensesMissingBase = db.prepare(
    "SELECT * FROM expenses WHERE base_amount_minor IS NULL ORDER BY id",
  );
  const backfillBase = db.prepare(
    "UPDATE expenses SET base_amount_minor = ?, base_currency = ?, fx_rate = ?, fx_rate_date = ?, updated_at = ? " +
      "WHERE id = ? AND base_amount_minor IS NULL AND amount_minor IS ? AND currency IS ? AND expense_date = ?",
  );
  const updateStatus = db.prepare("UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?");

  const selectSummaryTotals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN base_amount_minor END), 0) AS confirmed_total_minor,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN base_amount_minor END), 0) AS pending_total_minor,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count
    FROM expenses
    WHERE user_id = ? AND expense_date BETWEEN ? AND ? AND status IN ('confirmed', 'pending')
  `);
  const selectDailySpend = db.prepare(`
    SELECT expense_date AS date,
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN base_amount_minor END), 0) AS total_minor,
      SUM(CASE WHEN status IN ('confirmed', 'pending') THEN 1 ELSE 0 END) AS count
    FROM expenses
    WHERE user_id = ? AND expense_date BETWEEN ? AND ? AND status IN ('confirmed', 'pending')
    GROUP BY expense_date
    ORDER BY expense_date
  `);
  const selectCategorySpend = db.prepare(`
    SELECT COALESCE(category, 'other') AS category,
      COALESCE(SUM(base_amount_minor), 0) AS total_minor
    FROM expenses
    WHERE user_id = ? AND expense_date BETWEEN ? AND ? AND status = 'confirmed'
    GROUP BY COALESCE(category, 'other')
    ORDER BY total_minor DESC
  `);
  const selectWeekdaySpend = db.prepare(`
    SELECT CAST(strftime('%w', expense_date) AS INTEGER) AS weekday,
      COALESCE(SUM(base_amount_minor), 0) AS total_minor
    FROM expenses
    WHERE user_id = ? AND expense_date BETWEEN ? AND ? AND status = 'confirmed'
    GROUP BY weekday
  `);
  const selectExpensePage = db.prepare(`
    SELECT * FROM expenses
    WHERE user_id = ? AND expense_date BETWEEN ? AND ? AND status IN ('confirmed', 'pending')
    ORDER BY expense_date DESC, id DESC
    LIMIT ? OFFSET ?
  `);
  const selectExpensePageCount = db.prepare(`
    SELECT COUNT(*) AS total FROM expenses
    WHERE user_id = ? AND expense_date BETWEEN ? AND ? AND status IN ('confirmed', 'pending')
  `);
  const insertMessage = db.prepare("INSERT INTO messages (user_id, text, created_at) VALUES (?, ?, ?)");

  const insertToken = db.prepare(
    "INSERT INTO link_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  );
  const selectToken = db.prepare("SELECT * FROM link_tokens WHERE token = ?");
  const markTokenUsedIfUnused = db.prepare("UPDATE link_tokens SET used_at = ? WHERE token = ? AND used_at IS NULL");
  const deleteStaleTokens = db.prepare("DELETE FROM link_tokens WHERE expires_at <= ? OR used_at IS NOT NULL");
  const deleteUserTokens = db.prepare("DELETE FROM link_tokens WHERE user_id = ?");

  const insertFamily = db.prepare("INSERT INTO families (name, owner_id, created_at) VALUES (?, ?, ?)");
  const selectFamilyById = db.prepare("SELECT * FROM families WHERE id = ?");
  const selectActiveMembership = db.prepare(
    "SELECT * FROM family_members WHERE user_id = ? AND status = 'active' LIMIT 1",
  );
  const selectMembership = db.prepare("SELECT * FROM family_members WHERE family_id = ? AND user_id = ?");
  const selectMembers = db.prepare("SELECT * FROM family_members WHERE family_id = ? AND status = 'active'");
  const countOtherActive = db.prepare(
    "SELECT COUNT(*) AS n FROM family_members WHERE family_id = ? AND status = 'active' AND user_id != ?",
  );
  const insertMember = db.prepare(
    "INSERT INTO family_members (family_id, user_id, role, status, invited_by, created_at, joined_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const activateMember = db.prepare(
    "UPDATE family_members SET status = 'active', joined_at = ? WHERE family_id = ? AND user_id = ?",
  );
  const deleteMember = db.prepare("DELETE FROM family_members WHERE family_id = ? AND user_id = ?");
  const deleteFamilyMembers = db.prepare("DELETE FROM family_members WHERE family_id = ?");
  const deleteFamily = db.prepare("DELETE FROM families WHERE id = ?");
  const selectPendingInvites = db.prepare(
    "SELECT * FROM family_members WHERE user_id = ? AND status = 'invited'",
  );
  const selectVisible = db.prepare(`
    SELECT DISTINCT fm2.user_id AS user_id
    FROM family_members fm1
    JOIN family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = ? AND fm1.status = 'active' AND fm2.status = 'active'
  `);

  const selectExactRate = db.prepare(
    "SELECT rate, source_date AS date, source FROM exchange_rates " +
      "WHERE base_currency = ? AND quote_currency = ? AND requested_date = ?",
  );
  const selectNearestRate = db.prepare(
    "SELECT rate, source_date AS date, source FROM exchange_rates " +
      "WHERE base_currency = ? AND quote_currency = ? AND requested_date <= ? " +
      "ORDER BY requested_date DESC LIMIT 1",
  );
  const insertRate = db.prepare(
    "INSERT OR REPLACE INTO exchange_rates (base_currency, quote_currency, requested_date, rate, source_date, source) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
  );

  const insertStatement = db.prepare(
    "INSERT INTO bank_statements (user_id, bank, format, file_name, period_from, period_to, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTransaction = db.prepare(`
    INSERT INTO bank_transactions (statement_id, user_id, account, paid_at, expense_date, amount_minor, currency,
      account_amount_minor, account_currency, description, category, balance_minor, direction, card, fingerprint,
      created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, fingerprint) DO NOTHING
  `);
  const selectTransactionByFingerprint = db.prepare(
    "SELECT * FROM bank_transactions WHERE user_id = ? AND fingerprint = ?",
  );
  const selectTransactionsByStatement = db.prepare("SELECT * FROM bank_transactions WHERE statement_id = ? ORDER BY id");
  const selectLinkedTransaction = db.prepare(`
    SELECT t.card AS card, t.account AS account, s.bank AS bank
    FROM bank_transactions t JOIN bank_statements s ON s.id = t.statement_id
    WHERE t.expense_id = ? ORDER BY t.id DESC LIMIT 1
  `);
  const updateTransactionResolution = db.prepare(
    "UPDATE bank_transactions SET state = ?, expense_id = ? WHERE id = ?",
  );

  const insertProfile = db.prepare(`
    INSERT INTO import_profiles (user_id, fingerprint, bank, kind, roles, directives, status, created_at, use_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT (user_id, fingerprint) DO UPDATE SET
      bank = excluded.bank, kind = excluded.kind, roles = excluded.roles,
      directives = excluded.directives, status = excluded.status
  `);
  const selectProfile = db.prepare("SELECT * FROM import_profiles WHERE user_id = ? AND fingerprint = ?");
  const selectProfiles = db.prepare("SELECT * FROM import_profiles WHERE user_id = ? ORDER BY id");
  const updateProfileStatus = db.prepare(
    "UPDATE import_profiles SET status = ? WHERE user_id = ? AND fingerprint = ?",
  );
  const removeProfile = db.prepare("DELETE FROM import_profiles WHERE user_id = ? AND fingerprint = ?");
  const touchProfile = db.prepare(
    "UPDATE import_profiles SET last_used_at = ?, use_count = use_count + 1 WHERE user_id = ? AND fingerprint = ?",
  );

  const insertParticipant = db.prepare(
    "INSERT OR IGNORE INTO expense_participants (expense_id, user_id, role, origin, confidence, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
  );
  const deleteParticipant = db.prepare(
    "DELETE FROM expense_participants WHERE expense_id = ? AND user_id = ? AND role = ? AND origin = ?",
  );
  const selectParticipants = db.prepare(
    "SELECT * FROM expense_participants WHERE expense_id = ? ORDER BY id",
  );
  const insertEvent = db.prepare(
    "INSERT INTO expense_events (expense_id, kind, detail, transaction_id, actor_user_id, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
  );
  const selectEvents = db.prepare("SELECT * FROM expense_events WHERE expense_id = ? ORDER BY id");

  /**
   * Attribute an expense to its confirmed payer, or to its owner when none.
   * A payer is confirmed when the origin is not the bot: the bot records an
   * assumed payer at capture time, while an import or a manual entry confirms.
   */
  // ORDER BY id makes attribution deterministic when an expense has several
  // confirmed payers: the earliest recorded one owns the monetary attribution,
  // while every confirmed payer stays a participant.
  const ATTRIBUTED_USER =
    "COALESCE((SELECT p.user_id FROM expense_participants p " +
    "WHERE p.expense_id = e.id AND p.role = 'payer' AND p.origin <> 'bot' ORDER BY p.id LIMIT 1), e.user_id)";

  const selectScopedSummary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN base_amount_minor END), 0) AS confirmed_total_minor,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN base_amount_minor END), 0) AS pending_total_minor,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count
    FROM (
      SELECT e.*, ${ATTRIBUTED_USER} AS attributed_user_id FROM expenses e
      WHERE e.expense_date BETWEEN ? AND ? AND e.status IN ('confirmed', 'pending')
    ) WHERE attributed_user_id = ?
  `);
  const selectScopedDaily = db.prepare(`
    SELECT expense_date AS date,
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN base_amount_minor END), 0) AS total_minor,
      SUM(CASE WHEN status IN ('confirmed', 'pending') THEN 1 ELSE 0 END) AS count
    FROM (
      SELECT e.*, ${ATTRIBUTED_USER} AS attributed_user_id FROM expenses e
      WHERE e.expense_date BETWEEN ? AND ? AND e.status IN ('confirmed', 'pending')
    ) WHERE attributed_user_id = ?
    GROUP BY expense_date ORDER BY expense_date
  `);
  const selectScopedCategory = db.prepare(`
    SELECT COALESCE(category, 'other') AS category, COALESCE(SUM(base_amount_minor), 0) AS total_minor
    FROM (
      SELECT e.*, ${ATTRIBUTED_USER} AS attributed_user_id FROM expenses e
      WHERE e.expense_date BETWEEN ? AND ? AND e.status = 'confirmed'
    ) WHERE attributed_user_id = ?
    GROUP BY COALESCE(category, 'other') ORDER BY total_minor DESC
  `);
  const selectScopedWeekday = db.prepare(`
    SELECT CAST(strftime('%w', expense_date) AS INTEGER) AS weekday,
      COALESCE(SUM(base_amount_minor), 0) AS total_minor
    FROM (
      SELECT e.*, ${ATTRIBUTED_USER} AS attributed_user_id FROM expenses e
      WHERE e.expense_date BETWEEN ? AND ? AND e.status = 'confirmed'
    ) WHERE attributed_user_id = ?
    GROUP BY weekday
  `);
  // A participant keeps seeing a shared expense only while they and the owner
  // are still active members of the same family, so a removed member loses it.
  const selectScopedPage = db.prepare(`
    SELECT e.* FROM expenses e
    WHERE e.expense_date BETWEEN ? AND ? AND e.status IN ('confirmed', 'pending')
      AND (e.user_id = ? OR EXISTS (
        SELECT 1 FROM expense_participants p
        JOIN family_members viewer ON viewer.user_id = p.user_id AND viewer.status = 'active'
        JOIN family_members owner ON owner.family_id = viewer.family_id
          AND owner.user_id = e.user_id AND owner.status = 'active'
        WHERE p.expense_id = e.id AND p.user_id = ?))
    ORDER BY e.expense_date DESC, e.id DESC LIMIT ? OFFSET ?
  `);
  const selectScopedPageCount = db.prepare(`
    SELECT COUNT(*) AS total FROM expenses e
    WHERE e.expense_date BETWEEN ? AND ? AND e.status IN ('confirmed', 'pending')
      AND (e.user_id = ? OR EXISTS (
        SELECT 1 FROM expense_participants p
        JOIN family_members viewer ON viewer.user_id = p.user_id AND viewer.status = 'active'
        JOIN family_members owner ON owner.family_id = viewer.family_id
          AND owner.user_id = e.user_id AND owner.status = 'active'
        WHERE p.expense_id = e.id AND p.user_id = ?))
  `);

  /** Import profiles store roles and directives as JSON text in the row. */
  interface DbProfileRow extends Omit<ProfileRow, "roles" | "directives"> {
    roles: string;
    directives: string;
  }
  function parseProfile(row: DbProfileRow): ProfileRow {
    return { ...row, roles: JSON.parse(row.roles), directives: JSON.parse(row.directives) };
  }

  function findUserById(id: number): UserRow | undefined {
    return selectUserById.get(id) as unknown as UserRow | undefined;
  }

  function activeMembership(userId: number): FamilyMemberRow | undefined {
    return selectActiveMembership.get(userId) as unknown as FamilyMemberRow | undefined;
  }

  function visibleUserIds(viewerId: number): number[] {
    const rows = selectVisible.all(viewerId) as unknown as Array<{ user_id: number }>;
    const ids = new Set<number>([viewerId]);
    for (const row of rows) ids.add(row.user_id);
    return [...ids];
  }

  // Nest transactional writes with SAVEPOINT, so an import that wraps several
  // store calls in one transaction can still call appendExpense, which is
  // itself transactional.
  let txDepth = 0;
  function transact<T>(fn: () => T): T {
    const name = `sp${txDepth}`;
    db.exec(txDepth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${name}`);
    txDepth++;
    try {
      const result = fn();
      txDepth--;
      db.exec(txDepth === 0 ? "COMMIT" : `RELEASE ${name}`);
      return result;
    } catch (err) {
      txDepth--;
      db.exec(txDepth === 0 ? "ROLLBACK" : `ROLLBACK TO ${name}`);
      throw err;
    }
  }

  return {
    path: dbPath,

    resolveUser({ email, name, avatar, provider, subject }) {
      const now = nowIso();
      const normalizedEmail = email.trim().toLowerCase();

      const identity = selectIdentity.get(provider, subject) as unknown as { user_id: number } | undefined;
      if (identity) {
        updateLastLogin.run(now, identity.user_id);
        return findUserById(identity.user_id)!;
      }

      const existing = selectUserByEmail.get(normalizedEmail) as unknown as UserRow | undefined;
      if (existing) {
        insertIdentity.run(existing.id, provider, subject);
        updateLastLogin.run(now, existing.id);
        return findUserById(existing.id)!;
      }

      const result = insertUser.run(normalizedEmail, name, avatar, DEFAULT_CURRENCY, DEFAULT_TIMEZONE, now, now);
      const userId = Number(result.lastInsertRowid);
      insertIdentity.run(userId, provider, subject);
      return findUserById(userId)!;
    },

    findUserById,
    findUserByEmail(email) {
      return selectUserByEmail.get(email.trim().toLowerCase()) as unknown as UserRow | undefined;
    },
    findUserByTelegramId(telegramId) {
      return selectUserByTelegram.get(telegramId) as unknown as UserRow | undefined;
    },
    updateUserSettings(userId, fields) {
      const sets: string[] = [];
      const values: string[] = [];
      if (fields.display_currency !== undefined) {
        sets.push("display_currency = ?");
        values.push(fields.display_currency);
      }
      if (fields.display_timezone !== undefined) {
        sets.push("display_timezone = ?");
        values.push(fields.display_timezone);
      }
      if (sets.length === 0) return;
      db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values, userId);
    },

    appendExpense(row) {
      return transact(() => {
        const now = nowIso();
        const result = insertExpense.run(
          row.user_id,
          row.amount_minor,
          row.currency,
          row.base_amount_minor,
          row.base_currency,
          row.fx_rate,
          row.fx_rate_date,
          row.category,
          row.description,
          row.paid_at,
          row.paid_at_precision,
          row.expense_date,
          row.source,
          row.confidence,
          row.status,
          now,
          now,
        );
        const id = Number(result.lastInsertRowid);
        // Every expense has a recorder. A bot-recorded expense also gets an
        // assumed payer, since the actual payer is unknown at record time; an
        // imported expense gets its confirmed payer from reconciliation.
        const origin: ParticipantOrigin = row.source === "import" ? "import" : "bot";
        insertParticipant.run(id, row.user_id, "recorder", origin, 1, now);
        if (row.source !== "import") {
          insertParticipant.run(id, row.user_id, "payer", "bot", row.confidence, now);
        }
        insertEvent.run(id, "created", null, null, row.user_id, now);
        return id;
      });
    },
    findExpenseById(id) {
      return selectExpenseById.get(id) as unknown as ExpenseRow | undefined;
    },
    listExpensesMissingBase() {
      return selectExpensesMissingBase.all() as unknown as ExpenseRow[];
    },
    backfillExpenseBase(id, expected, base) {
      const result = backfillBase.run(
        base.base_amount_minor,
        base.base_currency,
        base.fx_rate,
        base.fx_rate_date,
        nowIso(),
        id,
        expected.amount_minor,
        expected.currency,
        expected.expense_date,
      );
      return result.changes === 1;
    },
    setExpenseStatus(id, status) {
      updateStatus.run(status, nowIso(), id);
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
      sets.push("updated_at = ?");
      values.push(nowIso());
      db.prepare(`UPDATE expenses SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
    },
    expenseSummary(userId, from, to) {
      const totals = selectSummaryTotals.get(userId, from, to) as unknown as {
        confirmed_total_minor: number;
        confirmed_count: number;
        pending_total_minor: number;
        pending_count: number;
      };
      const byDay = (selectDailySpend.all(userId, from, to) as unknown as Array<Record<string, unknown>>).map((row) => ({
        date: String(row.date),
        total_minor: Number(row.total_minor),
        count: Number(row.count),
      }));
      const byCategory = (
        selectCategorySpend.all(userId, from, to) as unknown as Array<{ category: string; total_minor: number }>
      ).map((row) => ({ category: row.category, total_minor: Number(row.total_minor) }));
      return {
        confirmed_total_minor: Number(totals.confirmed_total_minor),
        confirmed_count: Number(totals.confirmed_count),
        pending_total_minor: Number(totals.pending_total_minor),
        pending_count: Number(totals.pending_count),
        by_day: byDay,
        by_category: byCategory,
      };
    },
    listExpenses(userId, from, to, limit, offset) {
      const items = selectExpensePage.all(userId, from, to, limit, offset) as unknown as ExpenseRow[];
      const counted = selectExpensePageCount.get(userId, from, to) as unknown as { total: number };
      return { items, total: Number(counted.total) };
    },
    spendByWeekday(userId, from, to) {
      const rows = selectWeekdaySpend.all(userId, from, to) as unknown as Array<{ weekday: number; total_minor: number }>;
      return rows.map((row) => ({ weekday: Number(row.weekday), total_minor: Number(row.total_minor) }));
    },
    expenseSummaryForUser(viewerId, from, to) {
      const totals = selectScopedSummary.get(from, to, viewerId) as unknown as {
        confirmed_total_minor: number;
        confirmed_count: number;
        pending_total_minor: number;
        pending_count: number;
      };
      const byDay = (selectScopedDaily.all(from, to, viewerId) as unknown as Array<Record<string, unknown>>).map(
        (row) => ({ date: String(row.date), total_minor: Number(row.total_minor), count: Number(row.count) }),
      );
      const byCategory = (
        selectScopedCategory.all(from, to, viewerId) as unknown as Array<{ category: string; total_minor: number }>
      ).map((row) => ({ category: row.category, total_minor: Number(row.total_minor) }));
      return {
        confirmed_total_minor: Number(totals.confirmed_total_minor),
        confirmed_count: Number(totals.confirmed_count),
        pending_total_minor: Number(totals.pending_total_minor),
        pending_count: Number(totals.pending_count),
        by_day: byDay,
        by_category: byCategory,
      };
    },
    listExpensesForUser(viewerId, from, to, limit, offset) {
      const items = selectScopedPage.all(from, to, viewerId, viewerId, limit, offset) as unknown as ExpenseRow[];
      const counted = selectScopedPageCount.get(from, to, viewerId, viewerId) as unknown as { total: number };
      return { items, total: Number(counted.total) };
    },
    spendByWeekdayForUser(viewerId, from, to) {
      const rows = selectScopedWeekday.all(from, to, viewerId) as unknown as Array<{
        weekday: number;
        total_minor: number;
      }>;
      return rows.map((row) => ({ weekday: Number(row.weekday), total_minor: Number(row.total_minor) }));
    },
    findMatchCandidates(memberIds, amountMinor, currency, fromDate, toDate) {
      if (memberIds.length === 0) return [];
      const placeholders = memberIds.map(() => "?").join(", ");
      const stmt = db.prepare(
        `SELECT * FROM expenses WHERE user_id IN (${placeholders}) ` +
          "AND status IN ('confirmed', 'pending') AND amount_minor = ? AND currency = ? " +
          "AND expense_date BETWEEN ? AND ? ORDER BY expense_date DESC, id DESC",
      );
      return stmt.all(...memberIds, amountMinor, currency, fromDate, toDate) as unknown as ExpenseRow[];
    },

    appendMessage(message) {
      insertMessage.run(message.user_id, message.text, message.created_at);
    },

    createLinkToken(userId, ttlSeconds) {
      const token = randomBytes(16).toString("base64url");
      const createdAt = nowIso();
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      // Purge stale rows and drop this user's earlier pending link, so the table
      // holds at most one live token per user and a new link invalidates the old.
      db.exec("BEGIN IMMEDIATE");
      try {
        deleteStaleTokens.run(createdAt);
        deleteUserTokens.run(userId);
        insertToken.run(token, userId, createdAt, expiresAt);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      return { token, expiresAt };
    },
    redeemLinkToken(token, telegramUserId) {
      const row = selectToken.get(token) as unknown as
        | { user_id: number; expires_at: string; used_at: string | null }
        | undefined;
      if (!row) return { ok: false, reason: "unknown" };
      if (row.used_at) return { ok: false, reason: "used" };
      if (row.expires_at <= nowIso()) return { ok: false, reason: "expired" };

      const taken = selectUserByTelegram.get(telegramUserId) as unknown as UserRow | undefined;
      if (taken && taken.id !== row.user_id) return { ok: false, reason: "telegram_taken" };

      // Consume the token and bind the account together, so a crash cannot leave
      // the account linked while the token stays reusable.
      db.exec("BEGIN IMMEDIATE");
      try {
        const marked = markTokenUsedIfUnused.run(nowIso(), token);
        if (marked.changes !== 1) {
          db.exec("ROLLBACK");
          return { ok: false, reason: "used" };
        }
        updateTelegram.run(telegramUserId, row.user_id);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        if (String(err).includes("UNIQUE")) return { ok: false, reason: "telegram_taken" };
        throw err;
      }
      return { ok: true, userId: row.user_id };
    },
    unlinkTelegram(userId) {
      // Clear the mapping and any live token together, so a crash cannot leave
      // the account unlinked while a redeemable token still binds it again.
      db.exec("BEGIN IMMEDIATE");
      try {
        updateTelegram.run(null, userId);
        deleteUserTokens.run(userId);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },

    createFamily(ownerId, name) {
      if (activeMembership(ownerId)) return { ok: false, reason: "already_in_family" };
      const now = nowIso();
      db.exec("BEGIN IMMEDIATE");
      try {
        const familyId = Number(insertFamily.run(name, ownerId, now).lastInsertRowid);
        insertMember.run(familyId, ownerId, "owner", "active", ownerId, now, now);
        db.exec("COMMIT");
        return { ok: true, familyId };
      } catch (err) {
        db.exec("ROLLBACK");
        if (String(err).includes("UNIQUE")) return { ok: false, reason: "already_in_family" };
        throw err;
      }
    },
    getFamilyForUser(userId) {
      const membership = activeMembership(userId);
      if (!membership) return undefined;
      const family = selectFamilyById.get(membership.family_id) as unknown as FamilyRow | undefined;
      if (!family) return undefined;
      return { family, membership };
    },
    listFamilyMembers(familyId) {
      return selectMembers.all(familyId) as unknown as FamilyMemberRow[];
    },
    inviteByEmail(familyId, inviterId, email) {
      const inviter = activeMembership(inviterId);
      if (!inviter || inviter.family_id !== familyId || inviter.role !== "owner") {
        return { ok: false, reason: "not_owner" };
      }
      const target = selectUserByEmail.get(email.trim().toLowerCase()) as unknown as UserRow | undefined;
      if (!target) return { ok: false, reason: "unknown_email" };
      if (activeMembership(target.id)) return { ok: false, reason: "invitee_in_family" };
      const existing = selectMembership.get(familyId, target.id) as unknown as FamilyMemberRow | undefined;
      if (existing) return { ok: false, reason: existing.status === "active" ? "already_member" : "already_invited" };

      insertMember.run(familyId, target.id, "member", "invited", inviterId, nowIso(), null);
      return { ok: true };
    },
    listPendingInvitations(userId) {
      const rows = selectPendingInvites.all(userId) as unknown as FamilyMemberRow[];
      const result: Array<{ family: FamilyRow; membership: FamilyMemberRow }> = [];
      for (const membership of rows) {
        const family = selectFamilyById.get(membership.family_id) as unknown as FamilyRow | undefined;
        if (family) result.push({ family, membership });
      }
      return result;
    },
    acceptInvitation(userId, familyId) {
      const invitation = selectMembership.get(familyId, userId) as unknown as FamilyMemberRow | undefined;
      if (!invitation || invitation.status !== "invited") return { ok: false, reason: "no_invite" };
      if (activeMembership(userId)) return { ok: false, reason: "already_in_family" };
      try {
        activateMember.run(nowIso(), familyId, userId);
      } catch (err) {
        // The partial unique index rejects a second active membership on a race.
        if (String(err).includes("UNIQUE")) return { ok: false, reason: "already_in_family" };
        throw err;
      }
      return { ok: true, familyId };
    },
    declineInvitation(userId, familyId) {
      const invitation = selectMembership.get(familyId, userId) as unknown as FamilyMemberRow | undefined;
      if (!invitation || invitation.status !== "invited") return { ok: false, reason: "no_invite" };
      deleteMember.run(familyId, userId);
      return { ok: true };
    },
    leaveFamily(userId) {
      const membership = activeMembership(userId);
      if (!membership) return { ok: false, reason: "not_member" };
      if (membership.role === "owner") {
        const others = countOtherActive.get(membership.family_id, userId) as unknown as { n: number };
        if (others.n > 0) return { ok: false, reason: "owner_has_members" };
        // Last active member is the owner: dissolve the family so pending
        // invitations cannot be accepted into an ownerless family.
        db.exec("BEGIN IMMEDIATE");
        try {
          deleteFamilyMembers.run(membership.family_id);
          deleteFamily.run(membership.family_id);
          db.exec("COMMIT");
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }
        return { ok: true };
      }
      deleteMember.run(membership.family_id, userId);
      return { ok: true };
    },
    removeMember(ownerId, targetUserId) {
      const owner = activeMembership(ownerId);
      if (!owner || owner.role !== "owner") return { ok: false, reason: "not_owner" };
      if (targetUserId === ownerId) return { ok: false, reason: "cannot_remove_owner" };
      const target = selectMembership.get(owner.family_id, targetUserId) as unknown as FamilyMemberRow | undefined;
      if (!target || target.status !== "active") return { ok: false, reason: "not_member" };
      deleteMember.run(owner.family_id, targetUserId);
      return { ok: true };
    },
    visibleUserIds(viewerId) {
      return visibleUserIds(viewerId);
    },
    resolveScope(viewerId, scope) {
      if (scope === "me") return [viewerId];
      if (scope === "group") return visibleUserIds(viewerId);
      const match = /^member:(\d+)$/.exec(scope);
      if (match) {
        const memberId = Number(match[1]);
        if (memberId === viewerId || visibleUserIds(viewerId).includes(memberId)) return [memberId];
        throw new ScopeForbiddenError();
      }
      throw new ScopeForbiddenError();
    },

    appendStatement(row) {
      const result = insertStatement.run(
        row.user_id,
        row.bank,
        row.format,
        row.file_name,
        row.period_from,
        row.period_to,
        nowIso(),
      );
      return Number(result.lastInsertRowid);
    },
    appendTransaction(row) {
      const result = insertTransaction.run(
        row.statement_id,
        row.user_id,
        row.account,
        row.paid_at,
        row.expense_date,
        row.amount_minor,
        row.currency,
        row.account_amount_minor,
        row.account_currency,
        row.description,
        row.category,
        row.balance_minor,
        row.direction,
        row.card,
        row.fingerprint,
        nowIso(),
      );
      if (result.changes === 0) return null;
      return Number(result.lastInsertRowid);
    },
    findTransactionByFingerprint(userId, fingerprint) {
      return selectTransactionByFingerprint.get(userId, fingerprint) as unknown as TransactionRow | undefined;
    },
    findLinkedTransaction(expenseId) {
      return selectLinkedTransaction.get(expenseId) as unknown as
        | { card: string | null; account: string | null; bank: string | null }
        | undefined;
    },
    listTransactions(statementId) {
      return selectTransactionsByStatement.all(statementId) as unknown as TransactionRow[];
    },
    setTransactionResolution(transactionId, resolution) {
      updateTransactionResolution.run(resolution.state, resolution.expense_id, transactionId);
    },
    saveProfile(row) {
      insertProfile.run(
        row.user_id,
        row.fingerprint,
        row.bank,
        row.kind,
        JSON.stringify(row.roles),
        JSON.stringify(row.directives),
        row.status,
        nowIso(),
      );
      const saved = selectProfile.get(row.user_id, row.fingerprint) as unknown as DbProfileRow | undefined;
      return saved ? saved.id : 0;
    },
    findProfile(userId, fingerprint) {
      const row = selectProfile.get(userId, fingerprint) as unknown as DbProfileRow | undefined;
      return row ? parseProfile(row) : undefined;
    },
    listProfiles(userId) {
      return (selectProfiles.all(userId) as unknown as DbProfileRow[]).map(parseProfile);
    },
    setProfileStatus(userId, fingerprint, status) {
      updateProfileStatus.run(status, userId, fingerprint);
    },
    deleteProfile(userId, fingerprint) {
      removeProfile.run(userId, fingerprint);
    },
    markProfileUsed(userId, fingerprint) {
      touchProfile.run(nowIso(), userId, fingerprint);
    },

    addParticipant(row) {
      insertParticipant.run(row.expense_id, row.user_id, row.role, row.origin, row.confidence, nowIso());
    },
    removeParticipant(expenseId, userId, role, origin) {
      deleteParticipant.run(expenseId, userId, role, origin);
    },
    listParticipants(expenseId) {
      return selectParticipants.all(expenseId) as unknown as ParticipantRow[];
    },
    appendExpenseEvent(row) {
      insertEvent.run(row.expense_id, row.kind, row.detail, row.transaction_id, row.actor_user_id, nowIso());
    },
    listExpenseEvents(expenseId) {
      return selectEvents.all(expenseId) as unknown as ExpenseEventRow[];
    },

    getRateForDate(base, quote, requestedDate) {
      const row = selectExactRate.get(base, quote, requestedDate) as unknown as RateLookup | undefined;
      if (!row) return undefined;
      return { rate: row.rate, date: row.date, source: row.source };
    },
    getNearestRate(base, quote, requestedDate) {
      const row = selectNearestRate.get(base, quote, requestedDate) as unknown as RateLookup | undefined;
      if (!row) return undefined;
      return { rate: row.rate, date: row.date, source: row.source };
    },
    saveRate(base, quote, requestedDate, rate, sourceDate, source) {
      insertRate.run(base, quote, requestedDate, rate, sourceDate, source);
    },

    transaction<T>(fn: () => T): T {
      return transact(fn);
    },

    close() {
      db.close();
    },
  };
}

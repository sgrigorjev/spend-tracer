import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type ExpenseSource = "text" | "photo" | "voice";
export type ExpenseStatus = "pending" | "confirmed" | "rejected";
export type PaidAtPrecision = "date" | "minute";
export type FamilyRole = "owner" | "member";
export type FamilyMemberStatus = "invited" | "active";

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

/** Raised when a scope names a user outside the viewer's family. */
export class ScopeForbiddenError extends Error {
  constructor() {
    super("scope is outside the viewer's family");
    this.name = "ScopeForbiddenError";
  }
}

export interface Store {
  readonly path: string;
  // users
  resolveUser(input: ResolveUserInput): UserRow;
  findUserById(id: number): UserRow | undefined;
  findUserByEmail(email: string): UserRow | undefined;
  findUserByTelegramId(telegramId: number): UserRow | undefined;
  // expenses
  appendExpense(row: ExpenseInsert): number;
  setExpenseStatus(id: number, status: ExpenseStatus): void;
  updateExpense(id: number, fields: Partial<ExpenseUpdate>): void;
  // messages
  appendMessage(message: MessageRecord): void;
  // telegram linking
  createLinkToken(userId: number, ttlSeconds: number): { token: string; expiresAt: string };
  redeemLinkToken(token: string, telegramUserId: number): RedeemResult;
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
  source            TEXT NOT NULL CHECK (source IN ('text', 'photo', 'voice')),
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
  const updateStatus = db.prepare("UPDATE expenses SET status = ?, updated_at = ? WHERE id = ?");
  const insertMessage = db.prepare("INSERT INTO messages (user_id, text, created_at) VALUES (?, ?, ?)");

  const insertToken = db.prepare(
    "INSERT INTO link_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  );
  const selectToken = db.prepare("SELECT * FROM link_tokens WHERE token = ?");
  const markTokenUsed = db.prepare("UPDATE link_tokens SET used_at = ? WHERE token = ?");

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

  return {
    path: dbPath,

    resolveUser({ email, name, avatar, provider, subject }) {
      const now = nowIso();

      const identity = selectIdentity.get(provider, subject) as unknown as { user_id: number } | undefined;
      if (identity) {
        updateLastLogin.run(now, identity.user_id);
        return findUserById(identity.user_id)!;
      }

      const existing = selectUserByEmail.get(email) as unknown as UserRow | undefined;
      if (existing) {
        insertIdentity.run(existing.id, provider, subject);
        updateLastLogin.run(now, existing.id);
        return findUserById(existing.id)!;
      }

      const result = insertUser.run(email, name, avatar, DEFAULT_CURRENCY, DEFAULT_TIMEZONE, now, now);
      const userId = Number(result.lastInsertRowid);
      insertIdentity.run(userId, provider, subject);
      return findUserById(userId)!;
    },

    findUserById,
    findUserByEmail(email) {
      return selectUserByEmail.get(email) as unknown as UserRow | undefined;
    },
    findUserByTelegramId(telegramId) {
      return selectUserByTelegram.get(telegramId) as unknown as UserRow | undefined;
    },

    appendExpense(row) {
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
      return Number(result.lastInsertRowid);
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

    appendMessage(message) {
      insertMessage.run(message.user_id, message.text, message.created_at);
    },

    createLinkToken(userId, ttlSeconds) {
      const token = randomBytes(16).toString("base64url");
      const createdAt = nowIso();
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      insertToken.run(token, userId, createdAt, expiresAt);
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

      updateTelegram.run(telegramUserId, row.user_id);
      markTokenUsed.run(nowIso(), token);
      return { ok: true, userId: row.user_id };
    },

    createFamily(ownerId, name) {
      if (activeMembership(ownerId)) return { ok: false, reason: "already_in_family" };
      const now = nowIso();
      const familyId = Number(insertFamily.run(name, ownerId, now).lastInsertRowid);
      insertMember.run(familyId, ownerId, "owner", "active", ownerId, now, now);
      return { ok: true, familyId };
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
      const target = selectUserByEmail.get(email) as unknown as UserRow | undefined;
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
      activateMember.run(nowIso(), familyId, userId);
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

    close() {
      db.close();
    },
  };
}

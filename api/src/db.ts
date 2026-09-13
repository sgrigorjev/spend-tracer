import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

/** One row in the users table. */
export interface UserRow {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
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

export interface AuthStore {
  readonly path: string;
  /** Resolve the identity to a user, creating rows as needed, and touch last_login. */
  resolveUser(input: ResolveUserInput): UserRow;
  findUserById(id: number): UserRow | undefined;
  close(): void;
}

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  avatar     TEXT,
  created_at TEXT NOT NULL,
  last_login TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identities (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  subject  TEXT NOT NULL,
  UNIQUE (provider, subject)
);
`;

/**
 * Open (creating if needed) the SQLite database at `dbPath` and return a
 * store. The parent directory is created on first use.
 */
export function createStore(dbPath: string = config.dbPath): AuthStore {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(CREATE_TABLES);

  const selectIdentity = db.prepare(
    "SELECT user_id FROM identities WHERE provider = ? AND subject = ?",
  );
  const selectUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
  const selectUserById = db.prepare("SELECT * FROM users WHERE id = ?");
  const insertUser = db.prepare(
    "INSERT INTO users (email, name, avatar, created_at, last_login) VALUES (?, ?, ?, ?, ?)",
  );
  const insertIdentity = db.prepare(
    "INSERT INTO identities (user_id, provider, subject) VALUES (?, ?, ?)",
  );
  const updateLastLogin = db.prepare("UPDATE users SET last_login = ? WHERE id = ?");

  return {
    path: dbPath,
    resolveUser({ email, name, avatar, provider, subject }) {
      const now = new Date().toISOString();

      const identity = selectIdentity.get(provider, subject) as unknown as { user_id: number } | undefined;
      if (identity) {
        updateLastLogin.run(now, identity.user_id);
        return selectUserById.get(identity.user_id) as unknown as UserRow;
      }

      const existing = selectUserByEmail.get(email) as unknown as UserRow | undefined;
      if (existing) {
        insertIdentity.run(existing.id, provider, subject);
        updateLastLogin.run(now, existing.id);
        return selectUserById.get(existing.id) as unknown as UserRow;
      }

      const result = insertUser.run(email, name, avatar, now, now);
      const userId = Number(result.lastInsertRowid);
      insertIdentity.run(userId, provider, subject);
      return selectUserById.get(userId) as unknown as UserRow;
    },
    findUserById(id) {
      return selectUserById.get(id) as unknown as UserRow | undefined;
    },
    close() {
      db.close();
    },
  };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, type ExpenseInsert, type ProfileDirectives, type ProfileRoleMap } from "../src/db.ts";
import { readCsv, parseDelimited, decodeText } from "../../shared/src/import/csv.ts";
import { readXlsx } from "../../shared/src/import/xlsx.ts";
import { detectKind } from "../../shared/src/import/detect.ts";
import { formatFingerprint } from "../../shared/src/import/fingerprint.ts";
import { applyProfile, checkIntegrity, parseDate, parseNumber } from "../../shared/src/import/profile.ts";
import { chooseBand, rankCandidates } from "../../shared/src/import/reconcile.ts";
import { importStatement, unlinkTransaction, MAX_STATEMENT_BYTES } from "../../shared/src/import/pipeline.ts";
import { parseMappingReply } from "../../shared/src/import/learn.ts";
import { readZip } from "../../shared/src/import/zip.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "fixtures");

const CSV_ROLES: ProfileRoleMap = {
  date: "Дата",
  category: "Категорія",
  card: "Картка",
  description: "Опис операції",
  account_amount: "Сума в валюті картки",
  account_currency: "Валюта картки",
  amount: "Сума в валюті транзакції",
  amount_currency: "Валюта транзакції",
  balance: "Залишок",
};

const CSV_DIRECTIVES: ProfileDirectives = {
  date_format: "DD.MM.YYYY HH:mm:ss",
  decimal: ".",
  thousands: "",
  sign: "signed",
  header_row: 1,
};

function baseExpense(overrides: Partial<ExpenseInsert>): ExpenseInsert {
  return {
    user_id: 1,
    amount_minor: 1639,
    currency: "EUR",
    base_amount_minor: 1639,
    base_currency: "EUR",
    fx_rate: 1,
    fx_rate_date: "2026-09-26",
    category: "groceries",
    description: "MERCADONA ORRIOLS",
    paid_at: "2026-09-26T15:56:33",
    paid_at_precision: "minute",
    expense_date: "2026-09-26",
    source: "photo",
    confidence: 0.9,
    status: "confirmed",
    ...overrides,
  };
}

test("detects a file kind from content, not its name", () => {
  assert.equal(detectKind(Buffer.from("Дата;Сума\n")), "csv");
  assert.equal(detectKind(Buffer.from("%PDF-1.7\n")), "pdf");
  assert.equal(detectKind(Buffer.from([0x89, 0x50, 0x4e, 0x47])), "image");
  assert.equal(detectKind(readFileSync(path.join(fixtures, "privat-sample.xlsx"))), "xlsx");
});

test("readCsv parses a semicolon statement with Cyrillic headers", () => {
  const grid = readCsv(readFileSync(path.join(fixtures, "privat-sample.csv")));
  assert.equal(grid.length, 4);
  assert.equal(grid[0][0], "Дата");
  assert.equal(grid[1][4], "-844.85");
});

test("readXlsx reads inline-string cells", () => {
  const grid = readXlsx(readFileSync(path.join(fixtures, "privat-sample.xlsx")));
  assert.equal(grid[0][0], "Дата");
  assert.equal(grid[0][1], "Опис операції");
  assert.equal(grid[1][1], "MERCADONA ORRIOLS");
  assert.equal(grid[1][2], "-844.85");
});

test("readXlsx refuses a macro-enabled workbook", () => {
  assert.throws(() => readXlsx(readFileSync(path.join(fixtures, "macro.xlsx"))), /macro/i);
});

test("readZip refuses an archive that expands past the limit", () => {
  const bytes = readFileSync(path.join(fixtures, "privat-sample.xlsx"));
  assert.throws(() => readZip(bytes, 10), /expands past/);
});

test("readXlsx refuses a zip that is not a workbook", () => {
  assert.throws(() => readXlsx(readFileSync(path.join(fixtures, "not-xlsx.zip"))), /not an XLSX workbook/);
});

test("pipeline refuses a binary file before calling the model", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stmt-"));
  const file = path.join(dir, "clip.mp4");
  writeFileSync(file, Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x00, 0x00]));

  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const deps = {
    generateMapping: async () => {
      throw new Error("model must not be called");
    },
    extractDocument: async () => {
      throw new Error("not used");
    },
    confirmProfile: async () => true,
    decide: async () => ({ action: "separate" as const }),
  };
  await assert.rejects(
    importStatement(store, user, { filePath: file, baseCurrency: "EUR" }, deps),
    /unsupported file format/,
  );
  store.close();
});

test("parseDelimited handles quotes, separators and newlines", () => {
  const grid = parseDelimited('a,b\n"x,1","line\n2"', ",");
  assert.deepEqual(grid, [
    ["a", "b"],
    ["x,1", "line\n2"],
  ]);
});

test("decodeText falls back when a BOM is present", () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Дата", "utf8")]);
  assert.equal(decodeText(bytes), "Дата");
});

test("parseNumber and parseDate honor separators and formats", () => {
  assert.equal(parseNumber("1.234,56", { decimal: ",", thousands: "." }), 1234.56);
  assert.equal(parseNumber("-844,85", { decimal: "," }), -844.85);
  assert.equal(parseDate("26.09.2026 15:56:33", "DD.MM.YYYY HH:mm:ss"), "2026-09-26T15:56:33");
  assert.equal(parseDate("2026-09-26"), "2026-09-26");
});

test("format fingerprint matches reordered headers and separates changed ones", () => {
  const sample = [["1", "2", "3"]];
  const a = formatFingerprint("csv", ["Date", "Amount", "Note"], sample);
  const b = formatFingerprint("csv", ["Note", "Date", "Amount"], sample);
  const c = formatFingerprint("csv", ["Date", "Amount", "Merchant"], sample);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("applyProfile normalizes amounts, direction and transfers", () => {
  const grid = readCsv(readFileSync(path.join(fixtures, "privat-sample.csv")));
  const drafts = applyProfile(grid, { roles: CSV_ROLES, directives: CSV_DIRECTIVES });
  assert.equal(drafts.length, 3);

  const mercadona = drafts[0];
  assert.equal(mercadona.direction, "outflow");
  assert.equal(mercadona.currency, "EUR");
  assert.equal(mercadona.amount_minor, -1639);
  assert.equal(mercadona.account_currency, "UAH");
  assert.equal(mercadona.account_amount_minor, -84485);
  assert.equal(mercadona.expense_date, "2026-09-26");

  const salary = drafts[2];
  assert.equal(salary.direction, "inflow");
});

test("row fingerprint ignores position when a balance identifies the row", () => {
  const grid = readCsv(readFileSync(path.join(fixtures, "privat-sample.csv")));
  const shifted = [["Історія операцій"], ...grid];
  const original = applyProfile(grid, { roles: CSV_ROLES, directives: CSV_DIRECTIVES });
  const moved = applyProfile(shifted, { roles: CSV_ROLES, directives: { ...CSV_DIRECTIVES, header_row: 2 } });
  assert.equal(original[0].fingerprint, moved[0].fingerprint);
});

test("checkIntegrity accepts a consistent balance sequence", () => {
  const grid = readCsv(readFileSync(path.join(fixtures, "privat-sample.csv")));
  const drafts = applyProfile(grid, { roles: CSV_ROLES, directives: CSV_DIRECTIVES });
  assert.deepEqual(checkIntegrity(drafts), { ok: true });
});

test("checkIntegrity rejects a broken balance", () => {
  const grid = readCsv(readFileSync(path.join(fixtures, "privat-sample.csv")));
  const drafts = applyProfile(grid, { roles: CSV_ROLES, directives: CSV_DIRECTIVES });
  drafts[1].balance_minor = 1;
  const result = checkIntegrity(drafts);
  assert.equal(result.ok, false);
});

test("appendExpense records a recorder, an assumed payer and a created event", () => {
  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const id = store.appendExpense(baseExpense({ user_id: user.id }));

  const roles = store.listParticipants(id).map((p) => `${p.role}:${p.origin}`);
  assert.deepEqual(roles.sort(), ["payer:bot", "recorder:bot"]);
  assert.equal(store.listExpenseEvents(id)[0].kind, "created");
  store.close();
});

test("a transaction fingerprint is stored once", () => {
  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const statementId = store.appendStatement({
    user_id: user.id,
    bank: "PrivatBank",
    format: "csv",
    file_name: "s.csv",
    period_from: "2026-09-01",
    period_to: "2026-09-30",
  });
  const row = {
    statement_id: statementId,
    user_id: user.id,
    account: "card",
    paid_at: "2026-09-26T15:56:33",
    expense_date: "2026-09-26",
    amount_minor: 1639,
    currency: "EUR",
    account_amount_minor: 84485,
    account_currency: "UAH",
    description: "MERCADONA",
    category: null,
    balance_minor: 993637,
    direction: "outflow" as const,
    card: "****6331",
    fingerprint: "fp-1",
  };
  assert.notEqual(store.appendTransaction(row), null);
  assert.equal(store.appendTransaction(row), null);
  store.close();
});

test("profiles are scoped per user", () => {
  const store = createStore(":memory:");
  const a = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const b = store.resolveUser({ email: "b@x.com", name: "B", avatar: null, provider: "g", subject: "b" });
  store.saveProfile({
    user_id: a.id,
    fingerprint: "fp",
    bank: "PrivatBank",
    kind: "csv",
    roles: CSV_ROLES,
    directives: CSV_DIRECTIVES,
    status: "verified",
  });
  assert.ok(store.findProfile(a.id, "fp"));
  assert.equal(store.findProfile(b.id, "fp"), undefined);
  store.close();
});

test("attribution follows the confirmed payer, list shows a shared expense", () => {
  const store = createStore(":memory:");
  const a = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const b = store.resolveUser({ email: "b@x.com", name: "B", avatar: null, provider: "g", subject: "b" });
  const family = store.createFamily(a.id, "Home");
  assert.equal(family.ok, true);
  const familyId = family.ok ? (family.familyId ?? 0) : 0;
  store.inviteByEmail(familyId, a.id, "b@x.com");
  store.acceptInvitation(b.id, familyId);

  const expenseId = store.appendExpense(baseExpense({ user_id: a.id, expense_date: "2026-09-26" }));
  const statementId = store.appendStatement({
    user_id: b.id,
    bank: "PrivatBank",
    format: "csv",
    file_name: "s.csv",
    period_from: "2026-09-01",
    period_to: "2026-09-30",
  });
  const transactionId = store.appendTransaction({
    statement_id: statementId,
    user_id: b.id,
    account: "card",
    paid_at: "2026-09-26T15:56:33",
    expense_date: "2026-09-26",
    amount_minor: 1639,
    currency: "EUR",
    account_amount_minor: 84485,
    account_currency: "UAH",
    description: "MERCADONA",
    category: null,
    balance_minor: null,
    direction: "outflow",
    card: "****6331",
    fingerprint: "fp-link",
  })!;
  store.transaction(() => {
    store.addParticipant({ expense_id: expenseId, user_id: b.id, role: "payer", origin: "import", confidence: 1 });
    store.addParticipant({ expense_id: expenseId, user_id: b.id, role: "confirmer", origin: "import", confidence: 1 });
    store.setTransactionResolution(transactionId, { state: "linked", expense_id: expenseId });
  });

  assert.equal(store.expenseSummaryForUser(a.id, "2026-09-01", "2026-09-30").confirmed_total_minor, 0);
  assert.equal(store.expenseSummaryForUser(b.id, "2026-09-01", "2026-09-30").confirmed_total_minor, 1639);

  const list = store.listExpensesForUser(b.id, "2026-09-01", "2026-09-30", 10, 0);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].user_id, a.id);

  unlinkTransaction(store, b.id, transactionId, expenseId);
  assert.equal(store.findTransactionByFingerprint(b.id, "fp-link")!.state, "unmatched");
  store.close();
});

test("attribution with several confirmed payers is deterministic", () => {
  const store = createStore(":memory:");
  const a = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const b = store.resolveUser({ email: "b@x.com", name: "B", avatar: null, provider: "g", subject: "b" });
  const c = store.resolveUser({ email: "c@x.com", name: "C", avatar: null, provider: "g", subject: "c" });
  const family = store.createFamily(a.id, "Home");
  assert.equal(family.ok, true);
  const familyId = family.ok ? (family.familyId ?? 0) : 0;
  store.inviteByEmail(familyId, a.id, "b@x.com");
  store.inviteByEmail(familyId, a.id, "c@x.com");
  store.acceptInvitation(b.id, familyId);
  store.acceptInvitation(c.id, familyId);

  const expenseId = store.appendExpense(baseExpense({ user_id: a.id }));
  store.addParticipant({ expense_id: expenseId, user_id: b.id, role: "payer", origin: "import", confidence: 1 });
  store.addParticipant({ expense_id: expenseId, user_id: c.id, role: "payer", origin: "import", confidence: 1 });

  assert.equal(store.expenseSummaryForUser(b.id, "2026-09-01", "2026-09-30").confirmed_total_minor, 1639);
  assert.equal(store.expenseSummaryForUser(c.id, "2026-09-01", "2026-09-30").confirmed_total_minor, 0);
  store.close();
});

test("reconciliation scores an exact same-day expense as a high match", () => {
  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const id = store.appendExpense(baseExpense({ user_id: user.id }));
  const expense = store.listExpenses(user.id, "2026-09-01", "2026-09-30", 10, 0).items[0];
  const ranked = rankCandidates({ expense_date: "2026-09-26", description: "MERCADONA ORRIOLS" }, [expense]);
  assert.equal(chooseBand(ranked), "high");
  assert.equal(ranked[0].expense.id, id);
  store.close();
});

test("a debit/credit-only profile parses through the fallback", () => {
  const grid = [
    ["Date", "Debit", "Credit", "Desc"],
    ["2026-09-26", "10.00", "", "Shop"],
    ["2026-09-27", "", "25.00", "Salary"],
  ];
  const drafts = applyProfile(grid, {
    roles: { date: "Date", debit: "Debit", credit: "Credit", description: "Desc" },
    directives: { sign: "separate_columns" },
  });
  assert.equal(drafts[0].direction, "outflow");
  assert.equal(drafts[0].amount_minor, -1000);
  assert.equal(drafts[1].direction, "inflow");
  assert.equal(drafts[1].amount_minor, 2500);
});

test("an impossible calendar date is rejected", () => {
  assert.equal(parseDate("30.02.2026", "DD.MM.YYYY"), null);
  assert.equal(parseDate("2026-13-01"), null);
});

test("candidate lookup never returns an outside-family expense", () => {
  const store = createStore(":memory:");
  const a = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const b = store.resolveUser({ email: "b@x.com", name: "B", avatar: null, provider: "g", subject: "b" });
  store.appendExpense(baseExpense({ user_id: a.id }));

  const withoutFamily = store.findMatchCandidates([b.id], 1639, "EUR", "2026-09-25", "2026-09-27");
  assert.equal(withoutFamily.length, 0);

  const family = store.createFamily(a.id, "Home");
  assert.equal(family.ok, true);
  store.inviteByEmail(family.ok ? (family.familyId ?? 0) : 0, a.id, "b@x.com");
  if (family.ok) store.acceptInvitation(b.id, family.familyId ?? 0);
  const withFamily = store.findMatchCandidates(store.visibleUserIds(b.id), 1639, "EUR", "2026-09-25", "2026-09-27");
  assert.equal(withFamily.length, 1);
  store.close();
});

test("a removed member loses a shared expense", () => {
  const store = createStore(":memory:");
  const a = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const b = store.resolveUser({ email: "b@x.com", name: "B", avatar: null, provider: "g", subject: "b" });
  const family = store.createFamily(a.id, "Home");
  assert.equal(family.ok, true);
  const familyId = family.ok ? (family.familyId ?? 0) : 0;
  store.inviteByEmail(familyId, a.id, "b@x.com");
  store.acceptInvitation(b.id, familyId);

  const expenseId = store.appendExpense(baseExpense({ user_id: a.id }));
  store.addParticipant({ expense_id: expenseId, user_id: b.id, role: "confirmer", origin: "import", confidence: 1 });
  assert.equal(store.listExpensesForUser(b.id, "2026-09-01", "2026-09-30", 10, 0).items.length, 1);

  store.leaveFamily(b.id);
  assert.equal(store.listExpensesForUser(b.id, "2026-09-01", "2026-09-30", 10, 0).items.length, 0);
  store.close();
});

test("unlink refuses an expense outside the importer's family", () => {
  const store = createStore(":memory:");
  const a = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const b = store.resolveUser({ email: "b@x.com", name: "B", avatar: null, provider: "g", subject: "b" });
  const expenseId = store.appendExpense(baseExpense({ user_id: a.id }));
  assert.throws(() => unlinkTransaction(store, b.id, 1, expenseId));
  store.close();
});

test("a same-day different-merchant expense is a middle-band match", () => {
  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  store.appendExpense(baseExpense({ user_id: user.id, expense_date: "2026-09-26", description: "OTHER SHOP" }));
  const expense = store.listExpenses(user.id, "2026-09-01", "2026-09-30", 10, 0).items[0];
  const ranked = rankCandidates({ expense_date: "2026-09-26", description: "MERCADONA ORRIOLS" }, [expense]);
  assert.equal(chooseBand(ranked), "middle");
  store.close();
});

test("rows from one statement never match each other", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stmt-"));
  const file = path.join(dir, "repeat.csv");
  writeFileSync(
    file,
    [
      "Дата;Опис операції;Сума;Валюта",
      "25.09.2026 12:00:00;BOMBON BOSS; -5.95;EUR",
      "23.09.2026 12:00:00;BOMBON BOSS; -5.95;EUR",
    ].join("\n"),
  );

  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  let asked = 0;
  const deps = {
    generateMapping: async () => ({
      bank: "Test",
      roles: { date: "Дата", description: "Опис операції", amount: "Сума", amount_currency: "Валюта" },
      directives: { date_format: "DD.MM.YYYY HH:mm:ss", decimal: ".", thousands: "", sign: "signed" as const },
    }),
    extractDocument: async () => {
      throw new Error("not used");
    },
    confirmProfile: async () => true,
    decide: async () => {
      asked++;
      return { action: "separate" as const };
    },
  };

  const summary = await importStatement(store, user, { filePath: file, baseCurrency: "EUR" }, deps);
  assert.equal(summary.created, 2);
  assert.equal(summary.linked, 0);
  assert.equal(asked, 0);
  store.close();
});

test("a mapping reply carries the bank name when the model provides one", () => {
  const withBank = parseMappingReply({ bank: "PrivatBank", roles: CSV_ROLES, directives: CSV_DIRECTIVES });
  assert.equal(withBank.bank, "PrivatBank");
  const withoutBank = parseMappingReply({ bank: null, roles: CSV_ROLES, directives: CSV_DIRECTIVES });
  assert.equal(withoutBank.bank, null);
});

test("pipeline refuses an oversized statement", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stmt-"));
  const file = path.join(dir, "big.csv");
  writeFileSync(file, Buffer.alloc(MAX_STATEMENT_BYTES + 1));

  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const deps = {
    generateMapping: async () => {
      throw new Error("should not be called");
    },
    extractDocument: async () => {
      throw new Error("not used");
    },
    confirmProfile: async () => true,
    decide: async () => ({ action: "separate" as const }),
  };
  await assert.rejects(
    importStatement(store, user, { filePath: file, baseCurrency: "EUR" }, deps),
    /too large/,
  );
  store.close();
});

test("an uncertain match honors the decision and is not asked twice", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stmt-"));
  const file = path.join(dir, "decide.csv");
  writeFileSync(
    file,
    ["Дата;Опис операції;Сума;Валюта", "25.09.2026 12:00:00;BOMBON BOSS; -5.95;EUR"].join("\n"),
  );

  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const existingId = store.appendExpense(
    baseExpense({
      user_id: user.id,
      amount_minor: 595,
      base_amount_minor: 595,
      description: "OTHER SHOP",
      expense_date: "2026-09-25",
      paid_at: "2026-09-25T12:00:00",
    }),
  );
  let asked = 0;
  const deps = {
    generateMapping: async () => ({
      bank: "Test",
      roles: { date: "Дата", description: "Опис операції", amount: "Сума", amount_currency: "Валюта" },
      directives: { date_format: "DD.MM.YYYY HH:mm:ss", decimal: ".", thousands: "", sign: "signed" as const },
    }),
    extractDocument: async () => {
      throw new Error("not used");
    },
    confirmProfile: async () => true,
    decide: async (input: { ranked: Array<{ expense: { id: number } }> }) => {
      asked++;
      return { action: "merge" as const, expenseId: input.ranked[0].expense.id };
    },
  };

  const first = await importStatement(store, user, { filePath: file, baseCurrency: "EUR" }, deps);
  assert.equal(first.linked, 1);
  assert.equal(first.created, 0);
  assert.equal(asked, 1);
  assert.ok(store.listParticipants(existingId).some((p) => p.role === "payer" && p.origin === "import"));

  const second = await importStatement(store, user, { filePath: file, baseCurrency: "EUR" }, deps);
  assert.equal(second.skipped, 1);
  assert.equal(asked, 1);
  store.close();
});

test("a linked expense exposes the card and bank", async () => {
  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const deps = {
    generateMapping: async () => ({ bank: "PrivatBank", roles: CSV_ROLES, directives: CSV_DIRECTIVES }),
    extractDocument: async () => {
      throw new Error("not used");
    },
    confirmProfile: async () => true,
    decide: async () => ({ action: "separate" as const }),
  };
  await importStatement(store, user, { filePath: path.join(fixtures, "privat-sample.csv"), baseCurrency: "EUR" }, deps);

  const page = store.listExpensesForUser(user.id, "2026-01-01", "2026-12-31", 10, 0);
  const link = store.findLinkedTransaction(page.items[0].id);
  assert.equal(link?.card, "5168 **** **** 6331");
  assert.equal(link?.bank, "PrivatBank");
  assert.ok(page.items[0].description.length > 0);
  store.close();
});

test("a rejected learned profile is discarded", async () => {
  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const deps = {
    generateMapping: async () => ({ bank: "PrivatBank", roles: CSV_ROLES, directives: CSV_DIRECTIVES }),
    extractDocument: async () => {
      throw new Error("not used");
    },
    confirmProfile: async () => false,
    decide: async () => ({ action: "separate" as const }),
  };
  await assert.rejects(
    importStatement(store, user, { filePath: path.join(fixtures, "privat-sample.csv"), baseCurrency: "EUR" }, deps),
  );
  assert.equal(store.listProfiles(user.id).length, 0);
  store.close();
});

test("pipeline learns a profile, then reuses it and skips duplicates", async () => {
  const store = createStore(":memory:");
  const user = store.resolveUser({ email: "a@x.com", name: "A", avatar: null, provider: "g", subject: "a" });
  const deps = {
    generateMapping: async () => ({
      bank: "PrivatBank",
      roles: CSV_ROLES,
      directives: CSV_DIRECTIVES,
    }),
    extractDocument: async () => {
      throw new Error("not used");
    },
    confirmProfile: async () => true,
    decide: async () => ({ action: "separate" as const }),
  };

  const first = await importStatement(
    store,
    user,
    { filePath: path.join(fixtures, "privat-sample.csv"), baseCurrency: "EUR" },
    deps,
  );
  assert.equal(first.profile, "learned");
  assert.equal(first.parsed, 3);
  assert.equal(first.created, 2);
  assert.equal(first.ignored, 1);

  const expenses = store.listExpensesForUser(user.id, "2026-01-01", "2026-12-31", 10, 0);
  assert.equal(expenses.items.length, 2);

  const second = await importStatement(
    store,
    user,
    { filePath: path.join(fixtures, "privat-sample.csv"), baseCurrency: "EUR" },
    deps,
  );
  assert.equal(second.profile, "reused");
  assert.equal(second.skipped, 3);
  assert.equal(second.created, 0);
  assert.equal(store.listExpensesForUser(user.id, "2026-01-01", "2026-12-31", 10, 0).items.length, 2);
  store.close();
});

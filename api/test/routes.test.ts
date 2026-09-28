import { test } from "node:test";
import assert from "node:assert/strict";
import type { ExpenseInsert } from "../src/db.ts";

// config.ts reads required env vars at import time; set minimal values.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_ALLOWED_EMAILS = "a@example.com,b@example.com";
process.env.SESSION_SECRET = "test-secret";
process.env.TELEGRAM_BOT_USERNAME = "";

const fastifySecureSession = (await import("@fastify/secure-session")).default;
const { pino } = await import("pino");
const { buildApp } = await import("../src/app.ts");
const { createStore } = await import("../src/db.ts");
const { registerTelegramRoutes } = await import("../src/routes/telegram.ts");
const { registerFamilyRoutes } = await import("../src/routes/family.ts");
const { registerSettingsRoutes } = await import("../src/routes/settings.ts");
const { registerExpensesRoutes } = await import("../src/routes/expenses.ts");
const { protectDocs } = await import("../src/guard.ts");

/** A confirmed expense row with sensible defaults, for seeding via the store. */
function expense(userId: number, overrides: Partial<ExpenseInsert> = {}): ExpenseInsert {
  return {
    user_id: userId,
    amount_minor: 1000,
    currency: "EUR",
    base_amount_minor: 1000,
    base_currency: "EUR",
    fx_rate: 1,
    fx_rate_date: "2026-09-01",
    category: "groceries",
    description: "seed",
    paid_at: "2026-09-01T10:00:00+02:00",
    paid_at_precision: "minute",
    expense_date: "2026-09-01",
    source: "text",
    confidence: 0.95,
    status: "confirmed",
    ...overrides,
  };
}

/** Build a test app where the `x-test-user` header seeds the session. */
async function buildTestApp() {
  const app = await buildApp(pino({ level: "silent" }));
  await app.register(fastifySecureSession, { key: Buffer.alloc(32, 7), cookie: { path: "/", httpOnly: true } });
  app.addHook("onRequest", async (request) => {
    const header = request.headers["x-test-user"];
    if (typeof header === "string" && header) request.session.set("userId", Number(header));
  });
  const store = createStore(":memory:");
  registerTelegramRoutes(app, store);
  registerFamilyRoutes(app, store);
  registerSettingsRoutes(app, store);
  registerExpensesRoutes(app, store);
  protectDocs(app, store);
  await app.ready();
  return { app, store };
}

test("telegram and family endpoints reject unauthenticated requests", async () => {
  const { app, store } = await buildTestApp();
  const routes: Array<[string, string]> = [
    ["POST", "/api/telegram/link"],
    ["GET", "/api/telegram/link/status"],
    ["DELETE", "/api/telegram/link"],
    ["POST", "/api/family"],
    ["GET", "/api/family/scope"],
    ["GET", "/api/settings"],
    ["PATCH", "/api/settings"],
    ["GET", "/api/expenses/summary"],
    ["GET", "/api/expenses"],
  ];
  for (const [method, url] of routes) {
    const res = await app.inject({ method: method as "GET" | "POST" | "PATCH" | "DELETE", url });
    assert.equal(res.statusCode, 401, `${method} ${url} should be 401`);
    assert.equal((res.json() as { code: string }).code, "unauthorized", `${method} ${url} should carry the code`);
  }
  await app.close();
  store.close();
});

test("an authenticated user can request a link token and see the status", async () => {
  const { app, store } = await buildTestApp();
  const userId = store.resolveUser({
    email: "a@example.com",
    name: "A",
    avatar: null,
    provider: "google",
    subject: "sub-a",
  }).id;

  const link = await app.inject({ method: "POST", url: "/api/telegram/link", headers: { "x-test-user": String(userId) } });
  assert.equal(link.statusCode, 200);
  const body = link.json() as { token: string; url: string | null; expiresAt: string };
  assert.equal(typeof body.token, "string");
  assert.ok(body.token.length > 0);
  assert.equal(body.url, null);

  const status = await app.inject({ method: "GET", url: "/api/telegram/link/status", headers: { "x-test-user": String(userId) } });
  assert.equal(status.statusCode, 200);
  assert.deepEqual(status.json(), { linked: false, telegramUserId: null });

  await app.close();
  store.close();
});

test("an authenticated user can unlink their Telegram account", async () => {
  const { app, store } = await buildTestApp();
  const userId = store.resolveUser({
    email: "a@example.com",
    name: "A",
    avatar: null,
    provider: "google",
    subject: "sub-a",
  }).id;
  const headers = { "x-test-user": String(userId) };

  // Bind a Telegram account directly, then remove it through the API.
  const { token } = store.createLinkToken(userId, 600);
  assert.ok(store.redeemLinkToken(token, 111).ok);

  const unlink = await app.inject({ method: "DELETE", url: "/api/telegram/link", headers });
  assert.equal(unlink.statusCode, 200);
  assert.deepEqual(unlink.json(), { linked: false, telegramUserId: null });

  const status = await app.inject({ method: "GET", url: "/api/telegram/link/status", headers });
  assert.deepEqual(status.json(), { linked: false, telegramUserId: null });
  assert.equal(store.findUserByTelegramId(111), undefined);

  await app.close();
  store.close();
});

test("the family scope endpoint returns 403 for a member outside the family", async () => {
  const { app, store } = await buildTestApp();
  const ownerId = store.resolveUser({ email: "a@example.com", name: "A", avatar: null, provider: "google", subject: "sub-a" }).id;
  const strangerId = store.resolveUser({ email: "b@example.com", name: "B", avatar: null, provider: "google", subject: "sub-b" }).id;
  store.createFamily(ownerId, "Home");

  const mine = await app.inject({ method: "GET", url: "/api/family/scope?scope=me", headers: { "x-test-user": String(ownerId) } });
  assert.equal(mine.statusCode, 200);
  assert.deepEqual(mine.json(), { userIds: [ownerId] });

  const stranger = await app.inject({
    method: "GET",
    url: `/api/family/scope?scope=member:${strangerId}`,
    headers: { "x-test-user": String(ownerId) },
  });
  assert.equal(stranger.statusCode, 403);

  await app.close();
  store.close();
});

test("the family endpoint returns pending invitations for a user with no family", async () => {
  const { app, store } = await buildTestApp();
  const ownerId = store.resolveUser({ email: "a@example.com", name: "A", avatar: null, provider: "google", subject: "sub-a" }).id;
  const inviteeId = store.resolveUser({ email: "b@example.com", name: "B", avatar: null, provider: "google", subject: "sub-b" }).id;
  const created = store.createFamily(ownerId, "Home");
  assert.ok(created.ok);
  store.inviteByEmail(created.familyId!, ownerId, "b@example.com");

  const res = await app.inject({ method: "GET", url: "/api/family", headers: { "x-test-user": String(inviteeId) } });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { family: unknown; pendingInvitations: unknown[] };
  assert.equal(body.family, null);
  assert.equal(body.pendingInvitations.length, 1);

  await app.close();
  store.close();
});

test("the invite endpoint rejects a non-string email with 400", async () => {
  const { app, store } = await buildTestApp();
  const ownerId = store.resolveUser({ email: "a@example.com", name: "A", avatar: null, provider: "google", subject: "sub-a" }).id;
  store.createFamily(ownerId, "Home");

  const res = await app.inject({
    method: "POST",
    url: "/api/family/invite",
    headers: { "x-test-user": String(ownerId) },
    payload: { email: 42 },
  });
  assert.equal(res.statusCode, 400);
  assert.equal((res.json() as { code: string }).code, "validation_failed");

  await app.close();
  store.close();
});

test("settings can be read and updated, and invalid values are rejected", async () => {
  const { app, store } = await buildTestApp();
  const userId = store.resolveUser({ email: "a@example.com", name: "A", avatar: null, provider: "google", subject: "sub-a" }).id;
  const headers = { "x-test-user": String(userId) };

  const initial = await app.inject({ method: "GET", url: "/api/settings", headers });
  assert.equal(initial.statusCode, 200);
  assert.deepEqual(initial.json(), { display_currency: "EUR", display_timezone: "Europe/Madrid" });

  const updated = await app.inject({
    method: "PATCH",
    url: "/api/settings",
    headers,
    payload: { display_currency: "usd", display_timezone: "America/New_York" },
  });
  assert.equal(updated.statusCode, 200);
  assert.deepEqual(updated.json(), { display_currency: "USD", display_timezone: "America/New_York" });

  const badCurrency = await app.inject({ method: "PATCH", url: "/api/settings", headers, payload: { display_currency: "AAA" } });
  assert.equal(badCurrency.statusCode, 400);
  assert.equal((badCurrency.json() as { code: string }).code, "invalid_currency");

  const badZone = await app.inject({ method: "PATCH", url: "/api/settings", headers, payload: { display_timezone: "Mars/Olympus" } });
  assert.equal(badZone.statusCode, 400);
  assert.equal((badZone.json() as { code: string }).code, "invalid_timezone");

  // A bare offset is accepted by Intl but is not an IANA zone name.
  const offset = await app.inject({ method: "PATCH", url: "/api/settings", headers, payload: { display_timezone: "+01:00" } });
  assert.equal(offset.statusCode, 400);
  assert.equal((offset.json() as { code: string }).code, "invalid_timezone");

  // Hour-only offsets are accepted by Intl too, and must be rejected as well.
  const hourOnlyOffset = await app.inject({ method: "PATCH", url: "/api/settings", headers, payload: { display_timezone: "+01" } });
  assert.equal(hourOnlyOffset.statusCode, 400);
  assert.equal((hourOnlyOffset.json() as { code: string }).code, "invalid_timezone");

  const after = await app.inject({ method: "GET", url: "/api/settings", headers });
  assert.deepEqual(after.json(), { display_currency: "USD", display_timezone: "America/New_York" });

  const partial = await app.inject({ method: "PATCH", url: "/api/settings", headers, payload: { display_timezone: "Europe/Kyiv" } });
  assert.deepEqual(partial.json(), { display_currency: "USD", display_timezone: "Europe/Kyiv" });

  await app.close();
  store.close();
});

test("the API docs are behind the session", async () => {
  const { app, store } = await buildTestApp();
  const userId = store.resolveUser({ email: "a@example.com", name: "A", avatar: null, provider: "google", subject: "sub-a" }).id;

  const anonymous = await app.inject({ method: "GET", url: "/api/docs/json" });
  assert.equal(anonymous.statusCode, 401);

  // The router decodes the path before matching, so an encoded docs path must
  // be guarded too rather than slipping past a raw-URL check.
  const encoded = await app.inject({ method: "GET", url: "/api/%64ocs/json" });
  assert.equal(encoded.statusCode, 401);

  const signedIn = await app.inject({ method: "GET", url: "/api/docs/json", headers: { "x-test-user": String(userId) } });
  assert.equal(signedIn.statusCode, 200);

  await app.close();
  store.close();
});

function signIn(store: Awaited<ReturnType<typeof buildTestApp>>["store"], email: string, subject: string): number {
  return store.resolveUser({ email, name: email, avatar: null, provider: "google", subject }).id;
}

test("the expenses summary reports the period, pending and the projection", async () => {
  const { app, store } = await buildTestApp();
  const userId = signIn(store, "a@example.com", "sub-a");
  const headers = { "x-test-user": String(userId) };

  store.appendExpense(expense(userId, { expense_date: "2026-09-05", base_amount_minor: 1000, category: "groceries" }));
  store.appendExpense(expense(userId, { expense_date: "2026-09-06", base_amount_minor: 2000, category: "transport" }));
  store.appendExpense(expense(userId, { expense_date: "2026-09-07", base_amount_minor: 500, category: "dining", status: "pending" }));
  store.appendExpense(expense(userId, { expense_date: "2026-09-08", base_amount_minor: 9999, category: "groceries", status: "rejected" }));
  // 2026-08-10 is a Monday, and August 2026 has five Mondays.
  store.appendExpense(expense(userId, { expense_date: "2026-08-10", base_amount_minor: 4000, category: "groceries" }));

  const res = await app.inject({ method: "GET", url: "/api/expenses/summary?preset=month&date=2026-09-27", headers });
  assert.equal(res.statusCode, 200);
  const body = res.json() as {
    currency: string;
    total: number;
    count: number;
    pendingCount: number;
    pendingTotal: number;
    period: { preset: string; from: string; to: string; end: string };
    comparison: { from: string; to: string };
    daily: Array<{ date: string; amount: number; count: number }>;
    byCategory: Array<{ category: string; amount: number; share: number }>;
    topCategory: { category: string } | null;
    projected: Array<{ date: string; amount: number }>;
    projectedTotal: number | null;
  };

  assert.equal(body.currency, "EUR");
  assert.deepEqual(body.period, { preset: "month", from: "2026-09-01", to: "2026-09-27", end: "2026-09-30" });
  assert.deepEqual(body.comparison, { from: "2026-08-01", to: "2026-08-31" });
  assert.equal(body.total, 30);
  assert.equal(body.count, 3);
  assert.equal(body.pendingCount, 1);
  assert.equal(body.pendingTotal, 5);
  assert.equal(body.daily.length, 27);
  assert.deepEqual(body.daily.find((day) => day.date === "2026-09-07"), { date: "2026-09-07", amount: 0, count: 1 });
  assert.deepEqual(body.byCategory, [
    { category: "transport", amount: 20, share: 2000 / 3000 },
    { category: "groceries", amount: 10, share: 1000 / 3000 },
  ]);
  assert.equal(body.topCategory?.category, "transport");
  assert.deepEqual(body.projected, [
    { date: "2026-09-28", amount: 8 },
    { date: "2026-09-29", amount: 0 },
    { date: "2026-09-30", amount: 0 },
  ]);
  assert.equal(body.projectedTotal, 38);

  await app.close();
  store.close();
});

test("the expenses list and summary are scoped to the signed-in user", async () => {
  const { app, store } = await buildTestApp();
  const alice = signIn(store, "a@example.com", "sub-a");
  const bob = signIn(store, "b@example.com", "sub-b");

  store.appendExpense(expense(alice, { expense_date: "2026-09-05", base_amount_minor: 1000 }));
  store.appendExpense(expense(alice, { expense_date: "2026-09-06", base_amount_minor: 2000 }));
  store.appendExpense(expense(alice, { expense_date: "2026-09-06", base_amount_minor: 300, status: "pending" }));
  store.appendExpense(expense(alice, { expense_date: "2026-09-07", base_amount_minor: 9999, status: "rejected" }));
  store.appendExpense(expense(bob, { expense_date: "2026-09-05", base_amount_minor: 7777 }));

  const headers = { "x-test-user": String(alice) };
  const first = await app.inject({ method: "GET", url: "/api/expenses?preset=month&date=2026-09-27&limit=2&offset=0", headers });
  assert.equal(first.statusCode, 200);
  const page = first.json() as { total: number; items: Array<{ id: number; status: string }> };
  assert.equal(page.total, 3);
  assert.equal(page.items.length, 2);
  assert.equal(page.items.every((item) => item.status !== "rejected"), true);

  const second = await app.inject({ method: "GET", url: "/api/expenses?preset=month&date=2026-09-27&limit=2&offset=2", headers });
  const rest = (second.json() as { items: Array<{ id: number }> }).items;
  const ids = [...page.items, ...rest].map((item) => item.id);
  assert.equal(new Set(ids).size, 3);

  // Bob's 7777 never reaches Alice's summary.
  const summary = await app.inject({ method: "GET", url: "/api/expenses/summary?preset=month&date=2026-09-27", headers });
  assert.equal((summary.json() as { total: number }).total, 30);

  await app.close();
  store.close();
});

test("the projection follows the preset and stays empty without a remainder", async () => {
  const { app, store } = await buildTestApp();
  const userId = signIn(store, "a@example.com", "sub-a");
  const headers = { "x-test-user": String(userId) };
  // 2026-09-16 is a Wednesday inside the previous week.
  store.appendExpense(expense(userId, { expense_date: "2026-09-16", base_amount_minor: 2000 }));
  store.appendExpense(expense(userId, { expense_date: "2026-08-10", base_amount_minor: 4000 }));

  const week = await app.inject({ method: "GET", url: "/api/expenses/summary?preset=week&date=2026-09-21", headers });
  const weekBody = week.json() as { projected: Array<{ date: string; amount: number }>; projectedTotal: number | null };
  assert.deepEqual(weekBody.projected.map((day) => day.date), [
    "2026-09-22",
    "2026-09-23",
    "2026-09-24",
    "2026-09-25",
    "2026-09-26",
    "2026-09-27",
  ]);
  assert.equal(weekBody.projected.find((day) => day.date === "2026-09-23")?.amount, 20);

  for (const preset of ["day", "two_weeks"]) {
    const res = await app.inject({ method: "GET", url: `/api/expenses/summary?preset=${preset}&date=2026-09-21`, headers });
    const body = res.json() as { projected: unknown[]; projectedTotal: number | null };
    assert.deepEqual(body.projected, [], `${preset} should have no remainder`);
    assert.equal(body.projectedTotal, null);
  }

  // The comparison month (December 2025) has no spending.
  const empty = await app.inject({ method: "GET", url: "/api/expenses/summary?preset=month&date=2026-01-15", headers });
  assert.equal((empty.json() as { projectedTotal: number | null }).projectedTotal, null);

  await app.close();
  store.close();
});

test("the summary converts to the display currency with one rate per request", async () => {
  const { app, store } = await buildTestApp();
  const userId = signIn(store, "a@example.com", "sub-a");
  store.updateUserSettings(userId, { display_currency: "USD" });
  store.appendExpense(expense(userId, { expense_date: "2026-09-05", base_amount_minor: 1000 }));
  // 2026-08-10 is a Monday, and August 2026 has five Mondays.
  store.appendExpense(expense(userId, { expense_date: "2026-08-10", base_amount_minor: 4000 }));

  const holder = globalThis as unknown as { fetch: unknown };
  const original = holder.fetch;
  let calls = 0;
  holder.fetch = () => {
    calls += 1;
    return Promise.resolve({ ok: true, json: async () => ({ date: "2026-09-27", rates: { USD: 1.1 } }) });
  };

  try {
    const headers = { "x-test-user": String(userId) };
    const first = await app.inject({
      method: "GET",
      url: "/api/expenses/summary?preset=month&date=2026-09-27",
      headers,
    });
    assert.equal(first.statusCode, 200);
    const body = first.json() as {
      currency: string;
      total: number;
      projected: Array<{ date: string; amount: number }>;
      projectedTotal: number | null;
    };
    assert.equal(body.currency, "USD");
    assert.equal(body.total, 11);
    assert.deepEqual(body.projected, [
      { date: "2026-09-28", amount: 8.8 },
      { date: "2026-09-29", amount: 0 },
      { date: "2026-09-30", amount: 0 },
    ]);
    assert.equal(body.projectedTotal, 19.8);

    // The rate is cached, so the second request reuses it without another lookup.
    const second = await app.inject({
      method: "GET",
      url: "/api/expenses/summary?preset=month&date=2026-09-27",
      headers,
    });
    assert.equal(second.statusCode, 200);
    assert.equal(calls, 1);
    const secondBody = second.json() as typeof body;
    assert.equal(secondBody.currency, "USD");
    assert.equal(secondBody.total, 11);
    assert.equal(secondBody.projectedTotal, 19.8);
  } finally {
    holder.fetch = original;
  }

  await app.close();
  store.close();
});

test("the summary falls back to the base currency when no rate resolves", async () => {
  const { app, store } = await buildTestApp();
  const userId = signIn(store, "a@example.com", "sub-a");
  store.updateUserSettings(userId, { display_currency: "USD" });
  store.appendExpense(expense(userId, { expense_date: "2026-09-05", base_amount_minor: 1000 }));

  const holder = globalThis as unknown as { fetch: unknown };
  const original = holder.fetch;
  holder.fetch = () => Promise.reject(new Error("offline"));

  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/expenses/summary?preset=month&date=2026-09-27",
      headers: { "x-test-user": String(userId) },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { currency: string; total: number };
    assert.equal(body.currency, "EUR");
    assert.equal(body.total, 10);
  } finally {
    holder.fetch = original;
  }

  await app.close();
  store.close();
});

test("the expenses endpoints reject an unknown preset, a bad date and a large limit", async () => {
  const { app, store } = await buildTestApp();
  const userId = signIn(store, "a@example.com", "sub-a");
  const headers = { "x-test-user": String(userId) };

  const badPreset = await app.inject({ method: "GET", url: "/api/expenses/summary?preset=quarter&date=2026-09-27", headers });
  assert.equal(badPreset.statusCode, 400);

  const badDate = await app.inject({ method: "GET", url: "/api/expenses?preset=month&date=2026-02-31", headers });
  assert.equal(badDate.statusCode, 400);

  const badLimit = await app.inject({ method: "GET", url: "/api/expenses?preset=month&date=2026-09-27&limit=1000", headers });
  assert.equal(badLimit.statusCode, 400);

  await app.close();
  store.close();
});

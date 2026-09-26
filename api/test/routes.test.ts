import { test } from "node:test";
import assert from "node:assert/strict";

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
const { protectDocs } = await import("../src/guard.ts");

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
  protectDocs(app, store);
  await app.ready();
  return { app, store };
}

test("telegram and family endpoints reject unauthenticated requests", async () => {
  const { app, store } = await buildTestApp();
  const routes: Array<[string, string]> = [
    ["POST", "/api/telegram/link"],
    ["GET", "/api/telegram/link/status"],
    ["POST", "/api/family"],
    ["GET", "/api/family/scope"],
    ["GET", "/api/settings"],
    ["PATCH", "/api/settings"],
  ];
  for (const [method, url] of routes) {
    const res = await app.inject({ method: method as "GET" | "POST" | "PATCH", url });
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

  const signedIn = await app.inject({ method: "GET", url: "/api/docs/json", headers: { "x-test-user": String(userId) } });
  assert.equal(signedIn.statusCode, 200);

  await app.close();
  store.close();
});

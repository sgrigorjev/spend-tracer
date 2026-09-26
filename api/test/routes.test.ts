import { test } from "node:test";
import assert from "node:assert/strict";

// config.ts reads required env vars at import time; set minimal values.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_ALLOWED_EMAILS = "a@example.com,b@example.com";
process.env.SESSION_SECRET = "test-secret";
process.env.TELEGRAM_BOT_USERNAME = "";

const Fastify = (await import("fastify")).default;
const fastifySecureSession = (await import("@fastify/secure-session")).default;
const { createStore } = await import("../src/db.ts");
const { registerTelegramRoutes } = await import("../src/routes/telegram.ts");
const { registerFamilyRoutes } = await import("../src/routes/family.ts");

/** Build a test app where the `x-test-user` header seeds the session. */
async function buildApp() {
  const app = Fastify();
  await app.register(fastifySecureSession, { key: Buffer.alloc(32, 7), cookie: { path: "/", httpOnly: true } });
  app.addHook("onRequest", async (request) => {
    const header = request.headers["x-test-user"];
    if (typeof header === "string" && header) request.session.set("userId", Number(header));
  });
  const store = createStore(":memory:");
  registerTelegramRoutes(app, store);
  registerFamilyRoutes(app, store);
  await app.ready();
  return { app, store };
}

test("telegram and family endpoints reject unauthenticated requests", async () => {
  const { app, store } = await buildApp();
  const routes: Array<[string, string]> = [
    ["POST", "/api/telegram/link"],
    ["GET", "/api/telegram/link/status"],
    ["POST", "/api/family"],
    ["GET", "/api/family/scope"],
  ];
  for (const [method, url] of routes) {
    const res = await app.inject({ method: method as "GET" | "POST", url });
    assert.equal(res.statusCode, 401, `${method} ${url} should be 401`);
  }
  await app.close();
  store.close();
});

test("an authenticated user can request a link token and see the status", async () => {
  const { app, store } = await buildApp();
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
  const { app, store } = await buildApp();
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
  const { app, store } = await buildApp();
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
  const { app, store } = await buildApp();
  const ownerId = store.resolveUser({ email: "a@example.com", name: "A", avatar: null, provider: "google", subject: "sub-a" }).id;
  store.createFamily(ownerId, "Home");

  const res = await app.inject({
    method: "POST",
    url: "/api/family/invite",
    headers: { "x-test-user": String(ownerId) },
    payload: { email: 42 },
  });
  assert.equal(res.statusCode, 400);

  await app.close();
  store.close();
});

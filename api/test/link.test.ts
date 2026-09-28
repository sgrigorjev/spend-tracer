import { test } from "node:test";
import assert from "node:assert/strict";

// db.ts pulls in config.ts, which reads required env vars at import time.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_ALLOWED_EMAILS = "a@example.com,b@example.com";
process.env.SESSION_SECRET = "test-secret";

const { createStore } = await import("../src/db.ts");

function makeUser(store: ReturnType<typeof createStore>, email: string, subject: string): number {
  return store.resolveUser({ email, name: email, avatar: null, provider: "google", subject }).id;
}

test("redeemLinkToken binds a Telegram account once and refuses every other case", () => {
  const store = createStore(":memory:");
  const userId = makeUser(store, "a@example.com", "sub-a");

  const { token } = store.createLinkToken(userId, 600);
  const ok = store.redeemLinkToken(token, 111);
  assert.ok(ok.ok);
  assert.equal(ok.userId, userId);
  assert.equal(store.findUserByTelegramId(111)?.id, userId);

  const reused = store.redeemLinkToken(token, 111);
  assert.equal(reused.ok, false);
  assert.equal(reused.reason, "used");

  const unknown = store.redeemLinkToken("not-a-token", 222);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "unknown");

  const expired = store.createLinkToken(userId, -1);
  const expiredResult = store.redeemLinkToken(expired.token, 333);
  assert.equal(expiredResult.ok, false);
  assert.equal(expiredResult.reason, "expired");

  const otherId = makeUser(store, "b@example.com", "sub-b");
  const otherToken = store.createLinkToken(otherId, 600);
  const taken = store.redeemLinkToken(otherToken.token, 111);
  assert.equal(taken.ok, false);
  assert.equal(taken.reason, "telegram_taken");

  store.close();
});

test("createLinkToken supersedes the user's earlier pending link", () => {
  const store = createStore(":memory:");
  const userId = makeUser(store, "a@example.com", "sub-a");

  const first = store.createLinkToken(userId, 600);
  const second = store.createLinkToken(userId, 600);

  const superseded = store.redeemLinkToken(first.token, 111);
  assert.equal(superseded.ok, false);
  assert.equal(superseded.reason, "unknown");

  const ok = store.redeemLinkToken(second.token, 222);
  assert.ok(ok.ok);
  assert.equal(ok.userId, userId);

  store.close();
});

test("unlinkTelegram clears the mapping and is idempotent", () => {
  const store = createStore(":memory:");
  const userId = makeUser(store, "a@example.com", "sub-a");

  const { token } = store.createLinkToken(userId, 600);
  assert.ok(store.redeemLinkToken(token, 111).ok);
  assert.equal(store.findUserByTelegramId(111)?.id, userId);

  store.unlinkTelegram(userId);
  assert.equal(store.findUserByTelegramId(111), undefined);
  assert.equal(store.findUserById(userId)?.telegram_user_id, null);

  // A second unlink of an already-unlinked account succeeds without changing it.
  store.unlinkTelegram(userId);
  assert.equal(store.findUserById(userId)?.telegram_user_id, null);

  store.close();
});

test("unlinkTelegram discards a pending link token", () => {
  const store = createStore(":memory:");
  const userId = makeUser(store, "a@example.com", "sub-a");

  const { token } = store.createLinkToken(userId, 600);
  store.unlinkTelegram(userId);

  const redeemed = store.redeemLinkToken(token, 111);
  assert.equal(redeemed.ok, false);
  if (!redeemed.ok) assert.equal(redeemed.reason, "unknown");

  store.close();
});

test("createLinkToken purges expired and already-used tokens", () => {
  const store = createStore(":memory:");
  const expiredUserId = makeUser(store, "a@example.com", "sub-a");
  const usedUserId = makeUser(store, "b@example.com", "sub-b");
  const freshUserId = makeUser(store, "c@example.com", "sub-c");

  // An expired token is removed by the next mint for any user, and then reads
  // as unknown rather than expired.
  const expired = store.createLinkToken(expiredUserId, -1);
  store.createLinkToken(freshUserId, 600);
  const purgedExpired = store.redeemLinkToken(expired.token, 333);
  assert.equal(purgedExpired.ok, false);
  if (!purgedExpired.ok) assert.equal(purgedExpired.reason, "unknown");

  // A used token is removed the same way, and then reads as unknown rather
  // than already used.
  const used = store.createLinkToken(usedUserId, 600);
  assert.ok(store.redeemLinkToken(used.token, 111).ok);
  store.createLinkToken(freshUserId, 600);
  const purgedUsed = store.redeemLinkToken(used.token, 444);
  assert.equal(purgedUsed.ok, false);
  if (!purgedUsed.ok) assert.equal(purgedUsed.reason, "unknown");

  store.close();
});

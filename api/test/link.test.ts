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

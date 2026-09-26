import { test } from "node:test";
import assert from "node:assert/strict";

// db.ts pulls in config.ts, which reads required env vars at import time.
// Set minimal values so the store can be exercised without a real Google setup.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_ALLOWED_EMAILS = "a@example.com";
process.env.SESSION_SECRET = "test-secret";

const { createStore } = await import("../src/db.ts");

test("resolveUser creates a user and identity on first login", () => {
  const store = createStore(":memory:");
  const user = store.resolveUser({
    email: "a@example.com",
    name: "A",
    avatar: null,
    provider: "google",
    subject: "sub-1",
  });
  assert.equal(user.email, "a@example.com");
  assert.ok(user.id > 0);
  assert.equal(user.display_currency, "EUR");
  assert.equal(user.display_timezone, "Europe/Madrid");
  assert.equal(user.telegram_user_id, null);
  store.close();
});

test("resolveUser reuses the user when a new identity shares the email", () => {
  const store = createStore(":memory:");
  const first = store.resolveUser({
    email: "a@example.com",
    name: "A",
    avatar: null,
    provider: "google",
    subject: "sub-1",
  });
  const second = store.resolveUser({
    email: "a@example.com",
    name: "A",
    avatar: null,
    provider: "github",
    subject: "sub-2",
  });
  assert.equal(second.id, first.id);
  store.close();
});

test("resolveUser returns the same user for the same identity", () => {
  const store = createStore(":memory:");
  const input = {
    email: "a@example.com",
    name: "A",
    avatar: null,
    provider: "google",
    subject: "sub-1",
  };
  const first = store.resolveUser(input);
  const second = store.resolveUser(input);
  assert.equal(second.id, first.id);
  store.close();
});

test("email lookup and creation are case-insensitive", () => {
  const store = createStore(":memory:");
  const created = store.resolveUser({
    email: "Mixed@Example.com",
    name: "A",
    avatar: null,
    provider: "google",
    subject: "sub-1",
  });
  assert.equal(created.email, "mixed@example.com");
  assert.equal(store.findUserByEmail("MIXED@example.com")?.id, created.id);
  store.close();
});

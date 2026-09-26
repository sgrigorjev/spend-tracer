import { test } from "node:test";
import assert from "node:assert/strict";

// config.ts reads required env vars at import time; set minimal values.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_ALLOWED_EMAILS = "a@example.com";
process.env.SESSION_SECRET = "test-secret";

const { pino } = await import("pino");
const { buildApp } = await import("../src/app.ts");
const { createStore } = await import("../src/db.ts");
const { registerAuthRoutes } = await import("../src/routes/auth.ts");
const { registerDashboardRoutes } = await import("../src/routes/dashboard.ts");
const { registerTelegramRoutes } = await import("../src/routes/telegram.ts");
const { registerFamilyRoutes } = await import("../src/routes/family.ts");
const { registerSettingsRoutes } = await import("../src/routes/settings.ts");

test("the OpenAPI document lists every route with schemas", async () => {
  const app = await buildApp(pino({ level: "silent" }));
  const store = createStore(":memory:");
  registerAuthRoutes(app, store);
  registerDashboardRoutes(app, store);
  registerTelegramRoutes(app, store);
  registerFamilyRoutes(app, store);
  registerSettingsRoutes(app, store);
  await app.ready();

  const res = await app.inject({ method: "GET", url: "/api/docs/json" });
  assert.equal(res.statusCode, 200);
  const doc = res.json() as { paths: Record<string, Record<string, unknown>> };

  const expected = [
    "/api/auth/config",
    "/api/auth/google",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/dashboard",
    "/api/telegram/link",
    "/api/telegram/link/status",
    "/api/family",
    "/api/family/invite",
    "/api/family/invitations",
    "/api/family/invitations/{familyId}/accept",
    "/api/family/invitations/{familyId}/decline",
    "/api/family/leave",
    "/api/family/members/{userId}",
    "/api/family/scope",
    "/api/settings",
  ].sort();

  assert.deepEqual(Object.keys(doc.paths).sort(), expected);

  const ui = await app.inject({ method: "GET", url: "/api/docs/" });
  assert.equal(ui.statusCode, 200, "the docs UI should be served");

  await app.close();
  store.close();
});

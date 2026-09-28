import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

process.env.TELEGRAM_BOT_TOKEN ??= "test-token";
process.env.OPENAI_API_KEY ??= "test-key";
// dotenv does not override an existing value, so this wins over .env.
process.env.BASE_CURRENCY = "eur";

const { config } = await import("../src/config.ts");

test("the base currency is normalized to upper case", () => {
  assert.equal(config.baseCurrency, "EUR");
});

test("a relative DB_PATH resolves against the repo root", () => {
  assert.ok(path.isAbsolute(config.dbPath));
  assert.ok(config.dbPath.endsWith(path.join("data", "spend-tracer.db")));
});

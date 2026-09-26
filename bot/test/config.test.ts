import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TELEGRAM_BOT_TOKEN ??= "test-token";
process.env.OPENAI_API_KEY ??= "test-key";
// dotenv does not override an existing value, so this wins over .env.
process.env.BASE_CURRENCY = "eur";

const { config } = await import("../src/config.ts");

test("the base currency is normalized to upper case", () => {
  assert.equal(config.baseCurrency, "EUR");
});

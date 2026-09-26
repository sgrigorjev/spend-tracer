import { test } from "node:test";
import assert from "node:assert/strict";
import { paidAtPrecision, resolveExpenseDate } from "../../shared/src/dates.ts";

test("detects date-only and minute precision", () => {
  assert.equal(paidAtPrecision("2026-09-01"), "date");
  assert.equal(paidAtPrecision("2026-09-01T10:00:00+02:00"), "minute");
});

test("keeps the local day of an offset timestamp", () => {
  // 01:00 on the 26th in +02:00 is 23:00 UTC on the 25th; the local day wins.
  assert.equal(resolveExpenseDate("2026-09-26T01:00:00+02:00", "2026-09-26T00:00:00.000Z", "Europe/Madrid"), "2026-09-26");
});

test("keeps a bare date as-is", () => {
  assert.equal(resolveExpenseDate("2026-09-02", "2026-09-26T00:00:00.000Z", "Europe/Madrid"), "2026-09-02");
});

test("falls back to the record time in the owner timezone", () => {
  // 23:30 UTC on the 25th is 01:30 on the 26th in Madrid.
  assert.equal(resolveExpenseDate(null, "2026-09-25T23:30:00.000Z", "Europe/Madrid"), "2026-09-26");
  // The same instant is still the 25th in New York.
  assert.equal(resolveExpenseDate(null, "2026-09-25T23:30:00.000Z", "America/New_York"), "2026-09-25");
});

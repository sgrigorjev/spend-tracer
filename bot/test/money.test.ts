import { test } from "node:test";
import assert from "node:assert/strict";
import { fromMinor, minorExponent, toMinor } from "../../shared/src/money.ts";

test("converts decimal amounts to minor units with two decimals", () => {
  assert.equal(toMinor(12.5, "EUR"), 1250);
  assert.equal(toMinor(23.59, "EUR"), 2359);
  assert.equal(toMinor(0.01, "USD"), 1);
});

test("honours zero-decimal currencies", () => {
  assert.equal(minorExponent("JPY"), 0);
  assert.equal(toMinor(100, "JPY"), 100);
  assert.equal(fromMinor(100, "JPY"), 100);
});

test("honours three-decimal currencies", () => {
  assert.equal(minorExponent("KWD"), 3);
  assert.equal(toMinor(1.235, "KWD"), 1235);
});

test("round-trips through minor units", () => {
  assert.equal(fromMinor(1250, "EUR"), 12.5);
  assert.equal(fromMinor(2359, "eur"), 23.59);
});

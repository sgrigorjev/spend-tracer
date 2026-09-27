import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProjection,
  countDays,
  eachDay,
  isValidDate,
  periodEnd,
  remainingDays,
  resolvePeriod,
  todayInTimeZone,
} from "../../shared/src/period.ts";

test("resolves the current and comparison ranges for every preset", () => {
  assert.deepEqual(resolvePeriod("month", "2026-09-27"), {
    preset: "month",
    anchor: "2026-09-27",
    period: { from: "2026-09-01", to: "2026-09-27" },
    end: "2026-09-30",
    comparison: { from: "2026-08-01", to: "2026-08-31" },
  });
  assert.deepEqual(resolvePeriod("day", "2026-09-27"), {
    preset: "day",
    anchor: "2026-09-27",
    period: { from: "2026-09-27", to: "2026-09-27" },
    end: "2026-09-27",
    comparison: { from: "2026-09-26", to: "2026-09-26" },
  });
  // 2026-09-27 is a Sunday, so the week runs Monday the 21st through the anchor.
  assert.deepEqual(resolvePeriod("week", "2026-09-27"), {
    preset: "week",
    anchor: "2026-09-27",
    period: { from: "2026-09-21", to: "2026-09-27" },
    end: "2026-09-27",
    comparison: { from: "2026-09-14", to: "2026-09-20" },
  });
  assert.deepEqual(resolvePeriod("two_weeks", "2026-09-27"), {
    preset: "two_weeks",
    anchor: "2026-09-27",
    period: { from: "2026-09-14", to: "2026-09-27" },
    end: "2026-09-27",
    comparison: { from: "2026-08-31", to: "2026-09-13" },
  });
});

test("periodEnd is the calendar unit's last day", () => {
  assert.equal(periodEnd("month", "2026-09-27"), "2026-09-30");
  assert.equal(periodEnd("month", "2026-02-15"), "2026-02-28");
  assert.equal(periodEnd("week", "2026-09-23"), "2026-09-27");
  assert.equal(periodEnd("day", "2026-09-27"), "2026-09-27");
  assert.equal(periodEnd("two_weeks", "2026-09-27"), "2026-09-27");
});

test("the month comparison ends on the previous month's last day", () => {
  const { comparison } = resolvePeriod("month", "2026-03-15");
  assert.deepEqual(comparison, { from: "2026-02-01", to: "2026-02-28" });
});

test("remaining days run to the end of the calendar unit", () => {
  assert.deepEqual(remainingDays("month", "2026-09-27"), ["2026-09-28", "2026-09-29", "2026-09-30"]);
  assert.deepEqual(remainingDays("month", "2026-09-30"), []);
  assert.deepEqual(remainingDays("week", "2026-09-23"), ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  assert.deepEqual(remainingDays("week", "2026-09-27"), []);
  assert.deepEqual(remainingDays("day", "2026-09-27"), []);
  assert.deepEqual(remainingDays("two_weeks", "2026-09-27"), []);
});

test("eachDay and countDays walk a range inclusively", () => {
  assert.deepEqual(eachDay("2026-09-01", "2026-09-03"), ["2026-09-01", "2026-09-02", "2026-09-03"]);
  assert.equal(countDays({ from: "2026-09-01", to: "2026-09-27" }), 27);
  assert.equal(countDays({ from: "2026-09-01", to: "2026-09-30" }), 30);
});

test("isValidDate rejects impossible calendar dates", () => {
  assert.equal(isValidDate("2026-09-27"), true);
  assert.equal(isValidDate("2026-02-28"), true);
  assert.equal(isValidDate("2026-02-31"), false);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(isValidDate("27-09-2026"), false);
});

test("todayInTimeZone reads the local calendar day", () => {
  const instant = new Date("2026-09-25T23:30:00.000Z");
  assert.equal(todayInTimeZone("Europe/Madrid", instant), "2026-09-26");
  assert.equal(todayInTimeZone("America/New_York", instant), "2026-09-25");
});

test("projects the remaining month from the previous month's weekdays", () => {
  // August 2026 has five Mondays (3, 10, 17, 24, 31); 4000 over them averages 800.
  const weekdayTotals = new Map<number, number>([[1, 4000]]);
  const projection = buildProjection("month", "2026-09-27", { from: "2026-08-01", to: "2026-08-31" }, weekdayTotals, 5000);
  assert.deepEqual(projection, {
    days: [
      { date: "2026-09-28", amount_minor: 800 },
      { date: "2026-09-29", amount_minor: 0 },
      { date: "2026-09-30", amount_minor: 0 },
    ],
    total_minor: 5800,
  });
});

test("projects a week from the single previous week", () => {
  // The previous week has one Wednesday, worth 2000.
  const weekdayTotals = new Map<number, number>([[3, 2000]]);
  const projection = buildProjection("week", "2026-09-21", { from: "2026-09-14", to: "2026-09-20" }, weekdayTotals, 5000);
  assert.deepEqual(projection.days, [
    { date: "2026-09-22", amount_minor: 0 },
    { date: "2026-09-23", amount_minor: 2000 },
    { date: "2026-09-24", amount_minor: 0 },
    { date: "2026-09-25", amount_minor: 0 },
    { date: "2026-09-26", amount_minor: 0 },
    { date: "2026-09-27", amount_minor: 0 },
  ]);
  assert.equal(projection.total_minor, 7000);
});

test("a preset without a remainder or an empty comparison yields no projection", () => {
  const weekdayTotals = new Map<number, number>([[1, 4000]]);
  const comparison = { from: "2026-08-01", to: "2026-08-31" };
  assert.deepEqual(buildProjection("day", "2026-09-27", comparison, weekdayTotals, 5000), {
    days: [],
    total_minor: null,
  });
  assert.deepEqual(buildProjection("two_weeks", "2026-09-27", comparison, weekdayTotals, 5000), {
    days: [],
    total_minor: null,
  });
  assert.deepEqual(buildProjection("month", "2026-09-27", comparison, new Map(), 5000), {
    days: [],
    total_minor: null,
  });
});

/**
 * Period presets and their calendar ranges for the expenses dashboard. A range is
 * a pair of `YYYY-MM-DD` strings compared against the materialized `expense_date`,
 * so no per-row timezone math is needed. All arithmetic runs in UTC, so a DST
 * shift cannot move a day boundary.
 */

export type PeriodPreset = "day" | "week" | "two_weeks" | "month";

export const PERIOD_PRESETS: readonly PeriodPreset[] = ["day", "week", "two_weeks", "month"];

export interface DateRange {
  from: string;
  to: string;
}

export interface PeriodRanges {
  preset: PeriodPreset;
  anchor: string;
  period: DateRange;
  /** Last day of the period's calendar unit; equals the anchor when the unit ends there. */
  end: string;
  comparison: DateRange;
}

export interface ProjectedDay {
  date: string;
  amount_minor: number;
}

export interface Projection {
  days: ProjectedDay[];
  total_minor: number | null;
}

/** Whether the value is one of the supported period presets. */
export function isPeriodPreset(value: string): value is PeriodPreset {
  return (PERIOD_PRESETS as readonly string[]).includes(value);
}

function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whether the value is a real calendar date in `YYYY-MM-DD` form. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseDay(value);
  return !Number.isNaN(parsed.getTime()) && formatDay(parsed) === value;
}

/** Today's calendar date in an IANA timezone, as `YYYY-MM-DD`. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Shift a `YYYY-MM-DD` date by whole days. */
export function addDays(date: string, days: number): string {
  const shifted = parseDay(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return formatDay(shifted);
}

/** Day of week of a date: 0 = Sunday through 6 = Saturday. */
export function weekday(date: string): number {
  return parseDay(date).getUTCDay();
}

/** The first day of the month a date belongs to. */
function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** The last day of the month a date belongs to. */
function endOfMonth(date: string): string {
  const [year, month] = date.split("-").map(Number);
  const firstOfNext = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return addDays(firstOfNext, -1);
}

/** The Monday of the week a date belongs to. */
function startOfWeek(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

/** Every date from `from` to `to` inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Number of days in a range, inclusive. */
export function countDays(range: DateRange): number {
  const millis = parseDay(range.to).getTime() - parseDay(range.from).getTime();
  return Math.round(millis / 86_400_000) + 1;
}

function currentRange(preset: PeriodPreset, anchor: string): DateRange {
  switch (preset) {
    case "day":
      return { from: anchor, to: anchor };
    case "week":
      return { from: startOfWeek(anchor), to: anchor };
    case "two_weeks":
      return { from: addDays(anchor, -13), to: anchor };
    case "month":
      return { from: startOfMonth(anchor), to: anchor };
  }
}

function comparisonRange(preset: PeriodPreset, anchor: string, period: DateRange): DateRange {
  switch (preset) {
    case "day":
      return { from: addDays(anchor, -1), to: addDays(anchor, -1) };
    case "week": {
      const monday = startOfWeek(anchor);
      return { from: addDays(monday, -7), to: addDays(monday, -1) };
    }
    case "two_weeks":
      return { from: addDays(period.from, -14), to: addDays(period.from, -1) };
    case "month":
      return { from: startOfMonth(addDays(period.from, -1)), to: addDays(period.from, -1) };
  }
}

/** Resolve a preset and anchor into the current range and its comparison range. */
export function resolvePeriod(preset: PeriodPreset, anchor: string): PeriodRanges {
  const period = currentRange(preset, anchor);
  return { preset, anchor, period, end: periodEnd(preset, anchor), comparison: comparisonRange(preset, anchor, period) };
}

/**
 * The last day of a period's calendar unit: the end of the month for `month`,
 * the Sunday of the week for `week`, and the anchor itself for `day` and
 * `two_weeks`, whose unit already ends on the anchor.
 */
export function periodEnd(preset: PeriodPreset, anchor: string): string {
  if (preset === "month") return endOfMonth(anchor);
  if (preset === "week") return addDays(startOfWeek(anchor), 6);
  return anchor;
}

/**
 * The remaining days of a period's own calendar unit, after the anchor: to the
 * end of the month for `month`, to Sunday for `week`. `day` and `two_weeks` have
 * no remainder inside their unit, so the list is empty.
 */
export function remainingDays(preset: PeriodPreset, anchor: string): string[] {
  const end = periodEnd(preset, anchor);
  if (end === anchor) return [];
  return eachDay(addDays(anchor, 1), end);
}

/**
 * Project the remaining days of a calendar period from the comparison range's
 * per-weekday confirmed spend. Each remaining day expects the average of its
 * weekday over every occurrence of that weekday in the comparison range, and the
 * projected total is the current confirmed spend plus those expectations.
 * `weekdayTotalsMinor` is keyed by 0 = Sunday through 6 = Saturday. A preset
 * without a remainder, or an empty comparison range, yields no projection.
 */
export function buildProjection(
  preset: PeriodPreset,
  anchor: string,
  comparison: DateRange,
  weekdayTotalsMinor: ReadonlyMap<number, number>,
  currentConfirmedMinor: number,
): Projection {
  const remaining = remainingDays(preset, anchor);
  const hasComparison = [...weekdayTotalsMinor.values()].some((total) => total > 0);
  if (remaining.length === 0 || !hasComparison) return { days: [], total_minor: null };

  const occurrences = new Map<number, number>();
  for (const day of eachDay(comparison.from, comparison.to)) {
    const dayOfWeek = weekday(day);
    occurrences.set(dayOfWeek, (occurrences.get(dayOfWeek) ?? 0) + 1);
  }

  let expected = 0;
  const days: ProjectedDay[] = remaining.map((date) => {
    const dayOfWeek = weekday(date);
    const total = weekdayTotalsMinor.get(dayOfWeek) ?? 0;
    const count = occurrences.get(dayOfWeek) ?? 0;
    const amount_minor = count > 0 ? Math.round(total / count) : 0;
    expected += amount_minor;
    return { date, amount_minor };
  });

  return { days, total_minor: currentConfirmedMinor + expected };
}

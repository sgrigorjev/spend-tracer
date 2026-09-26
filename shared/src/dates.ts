import type { PaidAtPrecision } from "./db.ts";

/** Classify a paid_at value: a bare date is date-only, anything else is a time. */
export function paidAtPrecision(paidAt: string): PaidAtPrecision {
  return /^\d{4}-\d{2}-\d{2}$/.test(paidAt) ? "date" : "minute";
}

/**
 * Render the calendar date of a UTC instant in an IANA timezone, as
 * `YYYY-MM-DD`. en-CA formats with the year first, which is what we want.
 */
export function dateInTimeZone(instantIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instantIso));
}

/**
 * Resolve the local calendar day an expense belongs to. A paid_at value keeps
 * its own local date in the first ten characters, whether it is a bare date or
 * an offset timestamp, so no conversion is needed. Without paid_at, fall back
 * to the record time converted to the owner's timezone.
 */
export function resolveExpenseDate(paidAt: string | null, createdAtIso: string, timeZone: string): string {
  if (paidAt && paidAt.length >= 10) return paidAt.slice(0, 10);
  return dateInTimeZone(createdAtIso, timeZone);
}

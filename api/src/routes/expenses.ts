import { z } from "zod";
import type { App } from "../app.ts";
import type { DailySpendRow, Store, UserRow } from "../db.ts";
import { errorResponses } from "../schemas.ts";
import { requireUser } from "../guard.ts";
import { config } from "../config.ts";
import { getRate } from "../../../shared/src/fx.ts";
import { fromMinor } from "../../../shared/src/money.ts";
import {
  buildProjection,
  countDays,
  eachDay,
  isValidDate,
  resolvePeriod,
  todayInTimeZone,
  type DateRange,
  type PeriodRanges,
} from "../../../shared/src/period.ts";

const presetSchema = z.enum(["day", "week", "two_weeks", "month"]);
const dateSchema = z
  .string()
  .trim()
  .refine(isValidDate, { message: "expected a YYYY-MM-DD calendar date" });

const rangeQuery = z.object({
  preset: presetSchema.default("month"),
  date: dateSchema.optional(),
});

const listQuery = rangeQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const periodSchema = z.object({ preset: presetSchema, from: z.string(), to: z.string(), end: z.string() });
const rangeSchema = z.object({ from: z.string(), to: z.string() });
const amountSchema = z.object({ category: z.string(), amount: z.number(), share: z.number() });

const summarySchema = z.object({
  currency: z.string(),
  period: periodSchema,
  comparison: rangeSchema,
  total: z.number(),
  count: z.number(),
  pendingCount: z.number(),
  pendingTotal: z.number(),
  avgPerDay: z.number(),
  totalDeltaPct: z.number().nullable(),
  avgPerDayDeltaPct: z.number().nullable(),
  daily: z.array(z.object({ date: z.string(), amount: z.number(), count: z.number() })),
  byCategory: z.array(amountSchema),
  topCategory: amountSchema.nullable(),
  projected: z.array(z.object({ date: z.string(), amount: z.number() })),
  projectedTotal: z.number().nullable(),
});

const participantSchema = z.object({
  userId: z.number(),
  role: z.enum(["recorder", "payer", "confirmer"]),
  origin: z.enum(["bot", "import", "manual"]),
});

const listSchema = z.object({
  currency: z.string(),
  period: periodSchema,
  total: z.number(),
  items: z.array(
    z.object({
      id: z.number(),
      expense_date: z.string(),
      description: z.string(),
      category: z.string(),
      amount: z.number().nullable(),
      currency: z.string(),
      status: z.enum(["confirmed", "pending"]),
      shared: z.boolean(),
      participants: z.array(participantSchema),
    }),
  ),
});

/** Convert an amount in base minor units to display major units at one rate. */
function toAmount(minor: number, rate: number, currency: string): number {
  return fromMinor(Math.round(minor * rate), currency);
}

/** Percentage change between two amounts, or null when the baseline is zero. */
function percentDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Resolve the single base-to-display rate for the request. An identity
 * conversion short-circuits, and an unavailable rate falls back to the base
 * currency so the dashboard still renders.
 */
async function resolveRate(store: Store, user: UserRow, anchor: string): Promise<{ currency: string; rate: number }> {
  const base = config.baseCurrency;
  const lookup = await getRate(store, base, user.display_currency, anchor);
  if (!lookup) return { currency: base, rate: 1 };
  return { currency: user.display_currency, rate: lookup.rate };
}

/** Every day of the range, with a zero row where the store returned none. */
function fillDays(range: DateRange, rows: DailySpendRow[]): DailySpendRow[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return eachDay(range.from, range.to).map((date) => byDate.get(date) ?? { date, total_minor: 0, count: 0 });
}

function buildSummary(store: Store, userId: number, ranges: PeriodRanges, currency: string, rate: number) {
  const summary = store.expenseSummaryForUser(userId, ranges.period.from, ranges.period.to);
  const previous = store.expenseSummaryForUser(userId, ranges.comparison.from, ranges.comparison.to);

  const avgPerDayMinor = Math.round(summary.confirmed_total_minor / countDays(ranges.period));
  const prevAvgPerDayMinor = Math.round(previous.confirmed_total_minor / countDays(ranges.comparison));

  const byCategory = summary.by_category.map((row) => ({
    category: row.category,
    amount: toAmount(row.total_minor, rate, currency),
    share: summary.confirmed_total_minor > 0 ? row.total_minor / summary.confirmed_total_minor : 0,
  }));

  const weekdayTotals = new Map<number, number>();
  for (const row of store.spendByWeekdayForUser(userId, ranges.comparison.from, ranges.comparison.to)) {
    weekdayTotals.set(row.weekday, row.total_minor);
  }
  const projection = buildProjection(
    ranges.preset,
    ranges.anchor,
    ranges.comparison,
    weekdayTotals,
    summary.confirmed_total_minor,
  );

  return {
    currency,
    period: { preset: ranges.preset, from: ranges.period.from, to: ranges.period.to, end: ranges.end },
    comparison: { from: ranges.comparison.from, to: ranges.comparison.to },
    total: toAmount(summary.confirmed_total_minor, rate, currency),
    count: summary.confirmed_count + summary.pending_count,
    pendingCount: summary.pending_count,
    pendingTotal: toAmount(summary.pending_total_minor, rate, currency),
    avgPerDay: toAmount(avgPerDayMinor, rate, currency),
    totalDeltaPct: percentDelta(summary.confirmed_total_minor, previous.confirmed_total_minor),
    avgPerDayDeltaPct: percentDelta(avgPerDayMinor, prevAvgPerDayMinor),
    daily: fillDays(ranges.period, summary.by_day).map((row) => ({
      date: row.date,
      amount: toAmount(row.total_minor, rate, currency),
      count: row.count,
    })),
    byCategory,
    topCategory: byCategory[0] ?? null,
    projected: projection.days.map((day) => ({ date: day.date, amount: toAmount(day.amount_minor, rate, currency) })),
    projectedTotal: projection.total_minor === null ? null : toAmount(projection.total_minor, rate, currency),
  };
}

/** Expenses read endpoints for the dashboard, scoped to the signed-in user. */
export function registerExpensesRoutes(app: App, store: Store): void {
  app.get(
    "/api/expenses/summary",
    {
      preValidation: requireUser(store),
      schema: { querystring: rangeQuery, response: { 200: summarySchema, ...errorResponses } },
    },
    async (request) => {
      const user = request.user!;
      const anchor = request.query.date ?? todayInTimeZone(user.display_timezone);
      const ranges = resolvePeriod(request.query.preset, anchor);
      const { currency, rate } = await resolveRate(store, user, anchor);
      return buildSummary(store, user.id, ranges, currency, rate);
    },
  );

  app.get(
    "/api/expenses",
    {
      preValidation: requireUser(store),
      schema: { querystring: listQuery, response: { 200: listSchema, ...errorResponses } },
    },
    async (request) => {
      const user = request.user!;
      const anchor = request.query.date ?? todayInTimeZone(user.display_timezone);
      const ranges = resolvePeriod(request.query.preset, anchor);
      const { currency, rate } = await resolveRate(store, user, anchor);
      const page = store.listExpensesForUser(
        user.id,
        ranges.period.from,
        ranges.period.to,
        request.query.limit,
        request.query.offset,
      );
      return {
        currency,
        period: { preset: ranges.preset, from: ranges.period.from, to: ranges.period.to, end: ranges.end },
        total: page.total,
        items: page.items.map((row) => {
          const participants = store.listParticipants(row.id).map((p) => ({
            userId: p.user_id,
            role: p.role,
            origin: p.origin,
          }));
          return {
            id: row.id,
            expense_date: row.expense_date,
            description: row.description,
            category: row.category ?? "other",
            amount: row.base_amount_minor === null ? null : toAmount(row.base_amount_minor, rate, currency),
            currency,
            status: row.status === "confirmed" ? ("confirmed" as const) : ("pending" as const),
            shared: row.user_id !== user.id,
            participants,
          };
        }),
      };
    },
  );
}

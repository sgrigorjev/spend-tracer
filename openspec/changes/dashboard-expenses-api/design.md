## Context

See `proposal.md` for motivation. What shapes the approach:

- The schema from `redesign-expense-schema` already stores `expense_date` (a materialized local `YYYY-MM-DD`), `base_amount_minor` and `base_currency`, so grouping and filtering can work on date strings with no per-row timezone math.
- `shared/src/db.ts` exposes the store but has no expense read queries yet; `shared/src/fx.ts` already resolves a base-to-quote rate with a cache and a fallback; `shared/src/money.ts` handles minor-unit exponents.
- `api-foundation` gives every route the `requireUser` guard, zod validation and response serialization, a coded error shape, and publication in the OpenAPI document, so the new routes plug into that pattern rather than inventing one.
- `family-sharing` already owns the scope resolver. This change reads only the signed-in user's rows.

## Goals / Non-Goals

**Goals:**

- Two read endpoints the mockup can render from, using the existing store, FX and money helpers.
- One resolved range shape echoed to the client, so the UI header and both endpoints agree.
- Aggregates computed in SQL over a small dataset, returned in the user's display currency.
- A per-day projection of the remaining calendar period from the previous period, plus the projected period total.

**Non-Goals:**

- Family and member scope. Only the viewer's own expenses, as agreed for this change.
- CSV export, the web UI port, and any change to `/api/dashboard` or `web-ui`.
- Arbitrary user-supplied date ranges; presets are the only input.
- Storing or converting per-expense display amounts; the conversion stays on the aggregate.
- Statistical forecasting beyond the previous period's weekday average: no confidence bands, no trend, no seasonality model.

## Decisions

### Preset and anchor instead of from/to

The client sends `preset` (`day | week | two_weeks | month`, default `month`) and an optional `date` anchor (default today in the display timezone). The server resolves both ranges. Rationale: the comparison range depends on the calendar unit, and deriving it from a `from`/`to` pair alone is not possible without re-implementing the "previous calendar unit" rule in the client, where the two would drift. The anchor also lets the UI move to past periods later without a new contract. Alternative: explicit `from`/`to` plus a `compare` flag, rejected as more parameters and duplicated calendar logic.

### Current range runs through the anchor, comparison is a full unit

For `month`, the current range is month to date and the comparison is the whole previous calendar month (the mockup shows "September 1 – 20" against "vs last month"). The asymmetry is intentional and matches the chosen semantics. It is a reporting artifact, not a bug, and the UI labels it with the actual comparison unit.

### Boundaries on `expense_date` in the display timezone

The current day is computed with `Intl` in the user's `display_timezone`, and every range is a pair of `YYYY-MM-DD` strings compared against `expense_date`. Because `expense_date` is already the owner's local day, a string `BETWEEN from AND to` is exact and needs no per-row conversion. Week starts on Monday. Alternatives: converting `created_at`/`paid_at` per row in SQL, rejected as slower and timezone-fragile.

### Aggregation in SQL, conversion on the aggregate

Two grouped queries (by `expense_date`, by `category`) plus scalar totals run as prepared statements in the store; `node:sqlite` is synchronous and the dataset is tiny. Money is summed as `base_amount_minor`, converted once with a single base-to-display rate resolved through `getRate`, then rendered with `fromMinor`. Rationale: one rate lookup per request, matching the `data-model` decision that display currency applies to the aggregate. Alternative: returning base currency and converting in the browser, rejected because the rate and the base currency are server concerns.

### Status handling at the query level

The queries select `status IN ('confirmed', 'pending')`. The spend total and the series/category sums count `confirmed` rows only; the transaction count counts both; the pending count and amount are selected separately; `rejected` is never selected. This is the `data-model` status rule applied to the dashboard, and it matches the mockup's "34 transactions, 5 awaiting confirmation".

### Rows without a base equivalent

An expense whose `base_amount_minor` is null (no rate at write time) cannot carry money into an aggregate. Such rows are excluded from the monetary totals and the series and category sums, but still count toward the transaction count and appear in the list, so nothing silently disappears from the user's view.

### Projection by weekday from the comparison range

When the preset is `month` or `week`, the current range ends before the calendar unit does, so the handler builds a projection for the remaining days, from the day after the anchor through the last day of the month or through Sunday. The expected amount for a remaining day is the mean of the comparison range's confirmed spend on the same weekday, read with a `GROUP BY` on the weekday of `expense_date`. The projected total is the current confirmed total plus the sum of the expected days. `day` and `two_weeks` return an empty projection and a null total, because neither has a remainder inside its own unit and rolling a projection forward would need a different contract. Alternatives: a flat daily average over the comparison range, rejected as it discards the weekly rhythm; an index-aligned day N, rejected because weekdays do not line up between months.

### Endpoint and response shape

- `GET /api/expenses/summary?preset=&date=` returns `{ currency, period, comparison, total, count, pendingCount, pendingTotal, avgPerDay, avgPerDayDeltaPct, totalDeltaPct, daily[], byCategory[], topCategory, projected[], projectedTotal }`.
- `GET /api/expenses?preset=&date=&limit=&offset=` returns `{ currency, period, total, items[] }`, each item carrying id, expense_date, description, category, amount, currency and status.

`limit` defaults to 20 and is capped at 100; `offset` defaults to 0. Ordering is `expense_date DESC, id DESC` for a stable tiebreak.

### Placement

Pure range resolution lives in `shared/src/period.ts` with its own tests; read queries go in `shared/src/db.ts`; the routes in `api/src/routes/expenses.ts`, registered in `api/src/index.ts`, following the `api-foundation` route pattern.

## Security

- **Authorization.** Both endpoints run `requireUser` and filter `user_id = request.user.id`. No user, owner or scope identifier is accepted from the client, so there is no object-reference bypass to the "personal scope" requirement. Adding family scope later must go through the existing `family-sharing` resolver, not a client-supplied id.
- **Input validation.** `preset` is a closed enum, `date` must match `YYYY-MM-DD`, and `limit`/`offset` are bounded integers, enforced by zod before the handler, so a request cannot drive an unbounded scan or inject into the date comparison (values are bound as parameters regardless).
- **No data exposure beyond the owner.** Responses contain only the viewer's rows; error bodies stay the shared coded shape without internal detail.
- **Outbound dependency.** The only network call is the Frankfurter rate lookup, keyed by currency codes that are validated against `Intl.supportedValuesOf`, and it is cached; a failure degrades to base-currency amounts rather than an error.
- **Documentation.** Both routes declare their request and response schemas, so they appear in the OpenAPI document like every other route.

## Risks / Trade-offs

- **Partial vs full comparison misleads.** A month-to-date total compared with a full previous month can look like a drop late in the month. → The UI labels the actual comparison unit; the response returns both ranges so the label is accurate.
- **Delta instability on small numbers.** → The delta is null when the comparison total is zero; the UI hides the badge instead of showing infinity.
- **FX latency or outage at request time.** → `getRate` short-circuits on an identity conversion, hits the `exchange_rates` cache, and falls back to the nearest cached rate; a null rate returns base-currency amounts.
- **Unbounded list.** → `limit` is capped at 100.
- **A forgotten status filter leaks rejected spend into a total.** → All queries share one status predicate, and tests cover rejected exclusion in both the summary and the list.
- **The week projection rests on one sample per weekday.** The previous week has a single occurrence of each weekday, so its mean is that one day's value. → The series is labeled a projection and this is documented; it is a naive baseline, not a guarantee.
- **A one-off expense in the comparison range inflates every matching weekday.** → Accepted for a baseline projection; there is no smoothing in this change.

## Migration Plan

Additive only: new routes and new read queries, no schema or data change. Deploy is a normal API release. Rollback is reverting the code; the database is untouched.

## Open Questions

- Whether to add an explicit `from`/`to` escape hatch for the CSV export and free ranges.
- Whether the top total should later surface pending as a stacked figure rather than a separate number.
- Offset pagination is enough for the mockup; a cursor can replace it if the list grows.

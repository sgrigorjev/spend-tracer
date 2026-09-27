## Why

The dashboard has a finished mockup but no data behind it: `/api/dashboard` returns a `null` placeholder, and there is no way to read a user's expenses for a period. The schema redesign landed the storage the dashboard needs, so the read endpoints are the missing piece.

## What Changes

- Add `GET /api/expenses/summary` returning a period's aggregates: total spend, transaction count, daily average, per-day series, per-category totals and the top category, each with the previous-period figures and a percentage delta for total and daily average.
- Add `GET /api/expenses` returning the period's expense rows with offset pagination and the total row count.
- Resolve the period from a preset (`day`, `week`, `two_weeks`, `month`, default `month`) and an optional anchor date, in the user's `display_timezone`; the current range runs through the anchor day.
- Define "previous period" as the previous calendar unit: previous day, previous week (Mon–Sun) or full previous calendar month; for `two_weeks` it is the 14 days immediately before the current range. Return both ranges in the response.
- Project the remaining days of a calendar period from the previous period: for `month` from the day after the anchor through the last day of the month, and for `week` through Sunday. The expected amount for a remaining day is the average of the same weekday in the comparison range, and the response carries the projected days and the projected period total.
- Include confirmed and pending rows in the transaction count, report pending separately, and exclude rejected rows from both the aggregates and the list. Spend totals count confirmed rows only, per the `data-model` status rule.
- Return amounts in the user's `display_currency`, converting the base-currency aggregate once per request, and echo the currency used.
- Read only the signed-in user's own expenses (scope `me`); family and member scope stay out of this change.
- Follow the shared auth guard, zod schemas, coded error shape and OpenAPI publication from `api-foundation`.

## Capabilities

### New Capabilities

- `expense-reporting`: reading and aggregating a user's own expenses over a period for the dashboard, covering the period presets, the previous-period comparison, status inclusion, the display-currency conversion and pagination.

### Modified Capabilities

None. The scope resolver and its requirement already live in `family-sharing`; this change only consumes the personal branch of it.

## Impact

- `api/src/routes/expenses.ts` (new), registered in `api/src/index.ts`.
- `api/src/schemas.ts`: expense row and summary response schemas.
- `shared/src/db.ts`: read queries for the per-day, per-category and total aggregates and for the paged list.
- `shared/src/period.ts` (new): preset and anchor to current and previous ranges, and the remaining-period projection.
- `shared/src/money.ts` / `shared/src/fx.ts`: reused for minor-unit conversion and the base-to-display rate.
- `web/mockups/README.md`: reconcile the stale "Data the dashboard needs" section with the shared database and the new endpoints.

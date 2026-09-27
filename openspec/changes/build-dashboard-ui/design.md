## Context

See `proposal.md` for motivation. What shapes the approach:

- `expense-reporting` already serves `GET /api/expenses/summary` and `GET /api/expenses`, both scoped to the signed-in user and returning amounts in the display currency. The summary carries `period`, `comparison`, `total`, `count`, `pendingCount`, `pendingTotal`, `avgPerDay`, `totalDeltaPct`, `avgPerDayDeltaPct`, `daily[]`, `byCategory[]`, `topCategory`, `projected[]` and `projectedTotal`.
- `add-app-shell-and-settings` gives the dashboard a shell, a route at `/`, and the auth context with the user's name.
- `web/mockups/dashboard.html` fixes the layout: a period segmented control, four cards, a daily line chart, a category donut and a paged table. `web/mockups/README.md` already chose Recharts plus the shadcn `chart` wrapper.

## Goals / Non-Goals

**Goals:**

- One screen that renders the whole mockup from the two expense endpoints.
- A self-contained data flow: preset and page in, summary and list out.
- Charts that read the design tokens and stay close to the mockup.

**Non-Goals:**

- CSV export.
- Any scope other than the signed-in user; family and member scope stay for a later change.
- A per-row payer from the API; the column is served from the auth context for now.
- Any editing of expenses from the dashboard.

## Decisions

### One data hook, two requests in parallel

A `useExpenseDashboard(preset, page)` hook holds the preset and the offset, requests the summary and the list together, and returns `{ summary, list, loading, error }`. Changing the preset resets the page to the first. Each request is aborted when the preset or page changes again, so a slow earlier response cannot overwrite a newer one. Alternative: fetching in each component, rejected as duplicated loading and error handling.

### Presets only, the server resolves the range

The UI sends `preset` and never a date; the API resolves the current and comparison ranges in the user's timezone and echoes them. The toolbar renders `period.from` and `period.to` from the response, so the label cannot drift from the query. Alternative: the client computing ranges, rejected as duplicated calendar logic and a second source of truth.

### Charts with Recharts and the shadcn wrapper

The daily chart plots `daily` as the actual series and `projected` as a second, dashed series on the same date axis, so the remaining days read as a continuation rather than another measure. The category donut maps the nine categories to the `--chart-N` tokens already defined in `web-design-system`. Rationale: Recharts is the documented choice, and the shadcn `chart` wrapper gives the tooltip and legend the app's tokens.

### Payer from the auth context

The dashboard reads only the signed-in user's expenses, so every row's payer is that user; the column is filled from the auth context name, and no API change is needed. When family scope lands, the list endpoint must return a per-row payer and this column switches to it. Recorded as an open question.

### Formatting on the client

Amounts are formatted with `Intl.NumberFormat(undefined, { style: "currency", currency })` using the response currency, so the exponent follows the currency. Dates are `YYYY-MM-DD` and are formatted as UTC calendar days, so a date-only value cannot shift to the previous day in a negative-offset timezone. The mockup's page size of ten drives `limit`/`offset`; `total` comes from the list response.

### Component split

`Dashboard.tsx` composes `PeriodPresets`, `SummaryCards`, `DailyChart`, `CategoryDonut` and `ExpensesTable` under `web/src/components/dashboard/`. Each takes the slice it needs, so the screen stays readable and the pieces stay testable in isolation later.

## Security

- **The client cannot widen the read set.** The dashboard sends only a preset and pagination; the user identity comes from the session server-side, so there is no user or scope parameter to tamper with.
- **Only the viewer's data is rendered.** The payer column is the viewer's own name; no other user's identity reaches the page.
- **No raw server text.** Error states use the coded error shape, not arbitrary server messages.
- **Amounts are already converted server-side**, so the page does not fetch rates or handle credentials.
- **New dependency review.** `recharts` is added from the npm registry as a build-time dependency; it runs in the browser only and receives no secrets or session data.

## Risks / Trade-offs

- **Recharts adds bundle weight.** → Accepted, it is the documented choice; it is the only charting dependency.
- **The projection can be misread as actual spend.** → The projected series is dashed and labelled as projected, and the total cards count actual spend only.
- **A date shifting by a day in the browser's timezone.** → Format date-only values in UTC.
- **A stale response overwriting a newer one.** → Abort the in-flight requests on preset or page change.
- **Currencies without two decimals.** → `Intl.NumberFormat` applies the currency's own exponent.

## Open Questions

- CSV export (deferred).
- Whether the list endpoint should return a per-row payer before family scope, so the table does not change source later.
- Whether a settings change should refresh the dashboard immediately or only on the next load.

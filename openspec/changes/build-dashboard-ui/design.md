## Context

See `proposal.md` for motivation. What shapes the approach:

- `expense-reporting` already serves `GET /api/expenses/summary` and `GET /api/expenses`, both scoped to the signed-in user and returning amounts in the display currency. The summary carries `period` (`{ preset, from, to, end }`), `comparison`, `total`, `count`, `pendingCount`, `pendingTotal`, `avgPerDay`, `totalDeltaPct`, `avgPerDayDeltaPct`, `daily[]`, `byCategory[]`, `topCategory`, `projected[]` and `projectedTotal`.
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

The UI sends `preset` and never a date; the API resolves the current and comparison ranges in the user's timezone and echoes them. The toolbar renders `period.from` and `period.end` from the response, so the label cannot drift from the query. Alternative: the client computing ranges, rejected as duplicated calendar logic and a second source of truth.

### Charts with Recharts and the shadcn wrapper

The daily chart plots `daily` as the actual series and `projected` as a second, dashed series on the same date axis, so the remaining days read as a continuation rather than another measure. The category donut maps the nine categories to the `--chart-N` tokens from `web-design-system`; the app stylesheet now carries them, since until this change they existed only in the mockups. Three tokens are nudged for WCAG contrast (`--chart-3` in dark, `--chart-4` and `--chart-5` in light), where the mockup values are low-contrast on that theme; the rest match the mockup exactly. Rationale: Recharts is the documented choice, and the shadcn `chart` wrapper gives the tooltip and legend the app's tokens.

### Payer from the auth context

The dashboard reads only the signed-in user's expenses, so every row's payer is that user; the column shows the auth context avatar with the name as its tooltip (initials when there is no image), and no API change is needed. When family scope lands, the list endpoint must return a per-row payer and this column switches to it. Recorded as an open question.

### The chart spans the whole period, the server names its last day

The daily chart's axis runs from the period's first to its last calendar day, not only to the current day, so the projected days sit in a visible remainder rather than off the end. The last day comes from the resolved `period` the API returns (`period.end`); the client does not compute it, keeping the calendar logic on the server. Days after the current day carry no actual value, so the actual line stops at today while the axis and grid continue to the period end. The current day itself, the anchor the actuals run through, is drawn as a vertical reference line so the actual and projected halves read apart at a glance. Alternative: the client deriving the last day from the preset and the anchor, rejected as the duplicated calendar logic the resolved period already exists to avoid.

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
- **A full-period axis without a projection leaves an empty right side.** → Intended: that space is where the projection lands once the comparison period has data, and the header still names the full period.

## Open Questions

- CSV export (deferred).
- Whether the list endpoint should return a per-row payer before family scope, so the table does not change source later.
- Whether a settings change should refresh the dashboard immediately or only on the next load.

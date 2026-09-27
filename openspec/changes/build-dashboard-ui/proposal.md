## Why

The expenses API and the authenticated shell exist, but the dashboard body is still a placeholder. This change fills it with the period controls, the summary cards, the charts and the expenses table the mockup already defines.

## What Changes

- Wire the period presets (`day`, `week`, `two_weeks`, `month`, default `month`) to `GET /api/expenses/summary` and `GET /api/expenses`, and show the resolved range in the toolbar.
- Add four summary cards: total spent, transactions with the pending count, daily average, and top category; the total and daily average carry the delta against the previous period.
- Add a daily spend line chart that draws the whole period, from its first to its last calendar day, with the projected remaining days from the summary's `projected` series on the second half.
- Add a category breakdown as a donut with a legend of amount and share.
- Add the expenses table (date, description, category, payer, amount, status) with pagination.
- Render the charts with Recharts wrapped by the shadcn `chart` component.
- Leave CSV export out: it is a follow-up, not part of filling the dashboard.

## Capabilities

### New Capabilities

- `dashboard-ui`: the expenses dashboard screen: period selection, the summary cards, the daily and category charts, and the expenses table.

### Modified Capabilities

None.

## Impact

- `web/src/Dashboard.tsx` and new components under `web/src/components/dashboard/`.
- New dependency `recharts`; the shadcn `chart` component copied into `web/src/components/ui/`.
- `shared/src/period.ts` and `api/src/routes/expenses.ts`: the resolved period also carries the last day of its calendar unit, so the chart can span the whole period.
- Consumes `GET /api/expenses/summary` and `GET /api/expenses`.

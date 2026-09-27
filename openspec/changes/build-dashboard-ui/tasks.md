## 1. Charts dependency

- [x] 1.1 Add `recharts` to `web/` and copy the shadcn `chart` component into `web/src/components/ui/chart.tsx`, styled with the existing tokens. Verify with `npm run typecheck` in `web/` and by rendering a trivial chart. Security: a browser-only rendering dependency; it receives no session data.

## 2. Data flow

- [x] 2.1 Add a `useExpenseDashboard` hook that holds the preset and the page offset, requests the summary and the list together, aborts the previous requests when they change, and exposes loading and error state. Verify in the browser that switching the preset or paging cancels the stale request and renders the fresh data.

## 3. Period toolbar

- [x] 3.1 Add the period segmented control for `day`, `week`, `two_weeks` and `month` and the resolved-range label, both wired to the preset state. Verify the label matches the API `period` after each switch.

## 4. Summary cards

- [x] 4.1 Add the four cards (total spent, transactions with the pending note, daily average, top category) with the deltas, the null-delta case and the zero states. Verify against a seeded period and against an empty period.

## 5. Daily chart

- [x] 5.1 Add the daily spend chart plotting the `daily` series and, when present, the `projected` series as a distinct dashed line. Verify the projection appears for `month` and `week` and is absent for `day` and `two_weeks`.

## 6. Category donut

- [x] 6.1 Add the category donut with a legend of amount and share and an empty state. Verify against a seeded period and an empty one.

## 7. Expenses table

- [x] 7.1 Add the table with the date, description, category, payer, amount and status columns, the status badges, the payer from the auth context, pagination and the empty state. Verify paging, the disabled Previous on the first page, and that no rejected row appears. Security: the payer is the signed-in user only.

## 8. Verification

- [x] 8.1 Run `npm run typecheck` in `web/` and a browser pass: the default month, each preset, a period with data and an empty one, page next and previous, and the currency formatting for a non-EUR display currency.

## 9. Full-period axis

- [x] 9.1 Return the period's last calendar day from the API: add it to the resolved period in `shared/src/period.ts` and to the `period` in both expenses routes, and cover it in the period and route tests. Verify with `npm run typecheck` in `api/` and `bot/` and the targeted suites.
- [x] 9.2 Draw the daily chart across the whole period, from its first to its last day, keeping the actual series to the current day and the projection over the remainder. Verify in the browser that a monthly chart runs to the last day of the month.
- [x] 9.3 Show the period's first and last day in the toolbar (matching the chart axis) instead of the range through the current day, and update the period-selection spec scenario. Verify the label reads the full period.
- [x] 9.4 Mark the current day on the chart with a vertical reference line labelled as today, so the actual and projected halves separate. Verify the marker sits on the current day and the remaining days stay empty.
- [x] 9.5 Add the `--chart-1..9` tokens (and their Tailwind mappings) to `web/src/index.css`. Without them the daily line's `var(--color-actual)` resolved to an invalid stroke, so the chart rendered empty and the donut and badges lost their colors. Verify by screenshot that the line and the category colors render.
- [x] 9.6 Add the remaining design tokens (`--popover`, `--popover-foreground`, `--secondary`, `--secondary-foreground`, `--input`, `--ring` and their mappings) to `web/src/index.css`. The user menu uses `bg-popover`, which was undefined, so it rendered transparent over the page. Verify by screenshot that the menu is opaque.

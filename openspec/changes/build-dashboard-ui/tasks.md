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

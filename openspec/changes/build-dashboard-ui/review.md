# Review — build-dashboard-ui

Independent pass by the `reviewer` subagent (`deepseek/deepseek-v4-pro`), read-only, against `origin/main`. Recorded per the AGENTS.md code-review rule: every finding carries a disposition.

| # | Severity | Location | Finding | Disposition |
|---|----------|----------|---------|-------------|
| 1 | minor | `openspec/changes/build-dashboard-ui/design.md:32,69` | The design said the toolbar renders `period.to` and that the header names the actual data range, but the code renders `period.end`, the whole period. Doc contradicted the shipped behavior. | applied: the design now says `period.from`/`period.end` and "names the full period". |
| 2 | minor | `web/src/components/dashboard/CategoryDonut.tsx` | The donut tooltip's formatter returned only the amount, so hovering a slice showed no category. | applied: the formatter renders the category label and the amount, matching the daily chart. |
| 3 | minor | `web/src/components/ui/chart.tsx:102` via `CategoryDonut.tsx` | The chart config key becomes a CSS custom property name in `ChartStyle`; keyed by the raw API category it is a CSS-injection surface (the API does not re-validate the category at the read boundary). | applied: the donut config is keyed by `cat-<index>`, so no raw category reaches the style string. |
| 4 | nit | `web/src/Dashboard.tsx` | The range label omitted the year, ambiguous across a year boundary. | applied: the end date now carries the year. |
| 5 | nit | `web/src/components/dashboard/DailyChart.tsx` | Day-of-month x labels carry no month across a month boundary. | declined: the tooltip carries the full date, and month logic on a category axis would widen labels and cut the tick count. |
| 6 | nit | `web/src/lib/format.ts` | The pure format helpers are untested and their input units are easy to get wrong. | declined: `web/` has no test runner; adding one is a separate tooling change. The doc comments now name the units. |

Verdict: no blocker or major finding; findings 1-4 applied, 5-6 declined with reasons.

## CodeRabbit (PR #42)

| # | Severity | Location | Finding | Disposition |
|---|----------|----------|---------|-------------|
| 7 | minor | `web/src/components/dashboard/useExpenseDashboard.ts` | The summary and list requests sent only `preset`, so a run straddling local midnight could resolve different periods for the cards and the table. | applied: the summary is fetched first and the list is anchored to its `period.to`. |
| 8 | minor | `web/src/Dashboard.tsx` | After a failed request the heading could show the previous period beside the newly selected preset. | applied: the range renders only when `summary.period.preset` matches the selected preset. |

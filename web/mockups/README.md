# Web UI mockups

Static HTML mockups for the spend-tracer web UI. Open them in a browser, no build step.

- `login.html`: sign-in screen plus its loading and error states
- `dashboard.html`: expenses dashboard with period presets, charts and the expenses table

Both files load Tailwind and Inter from CDNs, so viewing them needs internet. They are mockups only, not part of the Vite build. `vite build` ignores this folder.

## Viewing

Open the file directly, or run the web container and use its URL:

- `http://127.0.0.1:8001/mockups/dashboard.html`
- `http://127.0.0.1:8001/mockups/login.html`

The web service bind-mounts this folder read-only into the nginx html root (see `docker-compose.yml`), which is what makes those URLs work. Without the mount, nginx falls through to its SPA `try_files` rule and serves the React app, which then redirects to `/login`. Remove the mount together with this folder once the mockups are implemented.

## Design tokens

The `<style type="text/tailwindcss">` block in each file mirrors shadcn/ui's default `neutral` theme: the same CSS variables (`--background`, `--card`, `--muted`, `--border`, `--chart-1..9`), the same `@theme inline` mapping, and the same `@custom-variant dark` selector. Class names in the markup (`bg-card`, `text-muted-foreground`, `border-border`, `rounded-xl`) carry over to the real app unchanged, so a mockup component can be pasted into `web/src` and it will render the same.

Chart colors extend shadcn's five to nine, since the bot classifies expenses into nine categories.

## Library choices

Styling is Tailwind CSS v4 with shadcn/ui. shadcn copies component source into the repo instead of adding a runtime dependency, so the components stay editable and there is nothing to keep in sync at upgrade time. Tailwind v4 plugs into Vite through `@tailwindcss/vite`.

Charts are Recharts, wrapped by shadcn's `chart` component. The wrapper adds themed colors (`var(--chart-N)`), a tooltip and a legend on top of Recharts' `BarChart` and `PieChart`. This covers both charts on the dashboard. Recharts is declarative React over SVG, which keeps the chart code close to the rest of the component tree.

Alternatives considered:

- Chart.js renders to canvas and ships less code, but its imperative API fits React worse and it needs a wrapper to feel native.
- ECharts handles more chart types than this dashboard will ever use, at roughly three times the bundle.
- Nivo looks good out of the box but is heavier and has more API surface than two charts justify.

## Screens

### Login

Centered card: brand mark, a Google sign-in button, and a note that access is limited to the allowlist. The real app renders Google Identity Services' own button; the mockup styles a stand-in so the button matches the rest of the UI. The annotation block at the bottom shows the loading state and the "email not allowed" alert.

### Dashboard

- Header with brand, theme toggle, and a user menu. The menu is drawn open to show the signed-in name, email and the Log out item.
- Period presets as a segmented control: day, week, two weeks, month. Month is the default and means the current calendar month.
- Four KPI cards: total for the period, operation count, daily average, top category. The first and third carry a delta against the previous period.
- Daily bar chart of spend per day, with a static hover tooltip.
- Category donut with a legend listing amount and share per category.
- Expenses table: date, description, category badge, payer, amount, status badge. Statuses are `Confirmed`, `Pending`, `Rejected`.
- A paginated footer over the table.

Both charts and the table read from arrays at the top of the `dashboard.html` script, so editing the sample data and reloading is enough to explore the layout.

## Data the dashboard needs

The API has to read the bot's `data/spend-tracer.db`, which is a separate SQLite file from `data/api.db`. Open it read-only and keep the queries in the API, not in the web app.

Two endpoints would cover the mockup:

- `GET /api/expenses/summary?from=&to=` returns `{ period, total, count, avgPerDay, daily[], byCategory[], topCategory }`.
- `GET /api/expenses?from=&to=&limit=&offset=` returns the table rows plus the total count for pagination.

## Open questions

- Which date groups an expense into a day: `paid_at` when set, otherwise `time`? The schema has both and `paid_at` is nullable.
- The `expenses` table stores a `currency` per row. The mockup assumes one currency. Either filter to the dominant currency or convert.
- Should the dashboard count only `confirmed` rows, or show `pending` and `rejected` behind a filter? The KPI "operations" and the table disagree if the answer differs.
- Whether the API reads the bot database directly or the bot writes a copy the API owns. Direct read-only access is simpler, but it couples the two services to one schema.

## Next steps

1. Add Tailwind v4 and shadcn to `web/`, run `npx shadcn init`, then add the components the mockup uses: `card`, `button`, `table`, `badge`, `tabs`, `dropdown-menu`, `chart`.
2. Port `Login.tsx` and `Dashboard.tsx` to the tokens and components here.
3. Add the summary and expenses endpoints to `api/`, reading `data/spend-tracer.db` read-only.
4. Wire the period presets to the API query params.

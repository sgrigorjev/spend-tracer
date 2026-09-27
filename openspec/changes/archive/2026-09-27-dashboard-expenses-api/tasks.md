## 1. Period resolution

- [x] 1.1 Add `shared/src/period.ts` with a pure resolver that takes a preset, an anchor date and an IANA timezone and returns the current and comparison `{ from, to }` ranges: `day`, `week` (Monday start), `two_weeks` and `month`, default `month`. Verify with `node --test test/period.test.ts` from `bot/`, covering all four presets, a month boundary and a DST day. Risk: an off-by-one on the last day would drop or add an expense.
- [x] 1.2 Resolve the default anchor as today in the user's display timezone via `Intl`, and reject a malformed anchor date. Verify with a test where a UTC instant near local midnight resolves to the expected local day. Security: the timezone comes from the authenticated user's profile, never from the request.
- [x] 1.3 Add the projection helper: given the preset, anchor, current confirmed total and the comparison range's per-weekday average, compute the remaining days (`month` through the last day of the month, `week` through Sunday), each expected amount, and the projected total; return empty and null for `day` and `two_weeks`. Verify with `node --test test/period.test.ts` covering both remainders, the weekday mapping and the no-remainder presets. Risk: it is a naive baseline, so it must stay clearly a projection, not a guarantee.

## 2. Store read queries

- [x] 2.1 Add summary queries to `shared/src/db.ts`: confirmed spend total, transaction and pending counts, pending amount, per-day and per-category sums, all filtered by `user_id = ?` and `status IN ('confirmed', 'pending')`. Verify with `node --test test/db.test.ts` from `bot/` over seeded rows, asserting rejected exclusion and that a null `base_amount_minor` row stays out of the money but in the count. Security: `user_id` is always a bound parameter.
- [x] 2.2 Add the paged list query and its total count, ordered `expense_date DESC, id DESC`. Verify with a test that walks every page and asserts no gaps or duplicates. Risk: an unstable order duplicates rows across pages.
- [x] 2.3 Add a store query for confirmed spend grouped by the weekday of `expense_date` within a date range, for the projection. Verify with a `test/db.test.ts` case asserting the per-weekday sums and that rejected rows and rows without a base equivalent are excluded.

## 3. Display-currency conversion

- [x] 3.1 Convert the base-currency aggregate with a single `getRate` call per request, reusing the identity short-circuit and falling back to base currency when no rate resolves, and echo the currency code. Verify with a test using an injected fetcher for the converted, identity and unavailable cases. Risk: a failed rate lookup must degrade to base amounts, not a 500.
- [x] 3.2 Convert the projected day amounts and the projected total with the same single rate, so the whole response shares one currency. Verify in the conversion test that the projected values carry the response currency.

## 4. API routes

- [x] 4.1 Add response schemas and `api/src/routes/expenses.ts` for `GET /api/expenses/summary` and `GET /api/expenses`, using `requireUser`, a closed preset enum, a `YYYY-MM-DD` anchor, and `limit`/`offset` with limit capped at 100. Register the routes in `api/src/index.ts`. Verify with `npm run typecheck` and `node --test test/routes.test.ts` from `api/`.
- [x] 4.2 Extend `api/test/openapi.test.ts` to assert a 200 response schema on both new operations. Risk: the OpenAPI test is the only contract check that the routes are documented.
- [x] 4.3 Extend the summary response schema with `projected[]` and the nullable `projectedTotal`, and wire the projection into the handler. Verify with `node --test test/routes.test.ts` from `api/`.

## 5. Route behavior tests

- [x] 5.1 Add cases to `api/test/routes.test.ts`: unauthenticated requests get 401; a second user's seeded expenses never appear in either endpoint; the summary reports total, count, pending and excludes rejected; the list paginates with a correct total. Security: the second-user case is the authorization guard against reading another user's expenses.
- [x] 5.2 Add projection cases to `api/test/routes.test.ts`: `month` projects through the last day of the month, `week` through Sunday, `day` and `two_weeks` return an empty projection and a null total, and an empty comparison range yields no projection rather than zeros.

## 6. Docs

- [x] 6.1 Update `web/mockups/README.md`: replace the stale "Data the dashboard needs" section with the single shared database, `expense_date` and the two new endpoints, and drop the open questions it now answers.

## 7. Final verification

- [x] 7.1 Run `npm run typecheck` in both `api/` and `bot/`, then the targeted suites (`test/period.test.ts`, `test/db.test.ts`, `test/routes.test.ts`, `test/openapi.test.ts`); all green before the PR.

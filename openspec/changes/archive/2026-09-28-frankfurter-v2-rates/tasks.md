## 1. Frankfurter v2 client

- [x] 1.1 Replace the v1 request and parse in `shared/src/fx.ts` with the v2 pair endpoint `https://api.frankfurter.dev/v2/rate/<base>/<quote>?date=<date>`, validating that `rate` is a number and `date` is present and recording the source as `frankfurter-v2`; verify a unit test with a stubbed v2 response returns the rate and stores the source
- [x] 1.2 Keep the identity short-circuit, the exact-date cache, and the nearest-earlier fallback; verify tests for identity, a cache hit that makes no fetch, and a fetch failure that falls back to an earlier cached rate
- [x] 1.3 Return null on a malformed or error v2 response rather than throwing; verify a test with a non-OK response and a test with a missing `rate`
- [x] 1.4 Update any existing test that stubs the Frankfurter URL or response to the v2 shape; verify the shared and bot suites pass

## 2. Rate backfill

- [x] 2.1 Add a store read that lists expenses whose `base_amount_minor` is null, plus the fields needed to recompute it; verify a test that returns only the empty rows
- [x] 2.2 Add `bot/src/cli/backfill-rates.ts` and an `npm run backfill:rates` script that resolves the rate per expense date through `getRate` and writes base amount, currency, rate and rate date through `updateExpense`, leaving filled rows alone and reporting unresolved ones; verify a test with a stubbed fetcher that fills a null base and skips a filled row
- [x] 2.3 Run the backfill against the local database and confirm the 34 UAH expenses gain a base amount and no EUR expense changes; verify the count of empty base rows drops to zero
- [x] 2.4 Re-check the dashboard after the backfill and confirm the September total rises to include the UAH spend and the previously empty amounts render with a value

## 3. Verification

- [x] 3.1 Run `npm run typecheck` in `shared/`, `bot/` and `api/`; verify all are clean
- [x] 3.2 Run the shared, bot and API test suites; verify they pass
- [x] 3.3 Confirm no code still references the deprecated `api.frankfurter.app` v1 endpoint; verify a search finds none

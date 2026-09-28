## Why

Imported expenses in UAH keep an empty base equivalent, so they are counted in the transaction list but excluded from every monetary total on the dashboard. The cause is the exchange-rate client: it calls the Frankfurter v1 endpoint, which serves only the European Central Bank reference list and does not quote the hryvnia. Frankfurter v2 blends 104 official sources and covers 208 currencies, including UAH through the National Bank of Ukraine, so the same provider can now resolve it. On the real September statement this hides roughly 20,900 UAH of spend.

## What Changes

- Point the exchange-rate client at the Frankfurter v2 API, which covers UAH, instead of the v1 endpoint.
- Keep the existing per-date cache and the nearest-earlier fallback, so the request volume does not change.
- Add a one-off backfill for expense rows whose base equivalent is empty, so already imported UAH expenses are filled from the rate for their own date.
- Ask the model to name the bank when it learns an import profile, so the bank field is populated instead of null.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-model`: rate coverage for every stored currency, and a backfill for an expense whose base equivalent was left empty.

## Impact

- `shared/src/fx.ts`: the Frankfurter endpoint, request shape and response parsing move to v2.
- `shared/src/db.ts`: a read for expenses with an empty base equivalent.
- `bot/src/cli/`: a backfill entry point that recomputes the missing base equivalents through the rate cache.
- `shared/src/import/learn.ts`: the mapping prompt asks for the bank name.
- `shared/src/fx.ts` tests and any test that stubs the Frankfurter response.

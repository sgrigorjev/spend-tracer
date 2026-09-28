## Context

See proposal.md for motivation. Current state that shapes the approach:

- `shared/src/fx.ts` has one provider, `fetchFrankfurter`, which calls `https://api.frankfurter.app/<date>?from=<base>&to=<quote>`, the v1 endpoint. v1 serves only the ECB reference list, so UAH and several other currencies resolve to nothing.
- `getRate` caches in `exchange_rates` keyed by `(base, quote, requested_date)`, uses the Fed rate for a date, and falls back to the nearest earlier cached rate. The API and the bot both call it.
- `exchange_rates` stores `source`, so the provider is recorded per row.
- `rate_unavailable` leaves `base_amount_minor` empty and the expense is excluded from monetary aggregates while still counted and listed.
- The import profile's `bank` field is whatever the model returns; on the real PrivatBank file it returned null, so the bank is missing on the expense detail.

## Goals / Non-Goals

**Goals:**

- Resolve UAH so imported UAH expenses get a base equivalent.
- Fill the already imported UAH expenses.
- Keep the request volume and the caching behavior unchanged.
- Populate the bank name on a learned import profile.

**Non-Goals:**

- Changing the base currency or the display-currency logic.
- Per-provider rate selection or a general multi-provider fallback chain. The v2 blended feed is the single source.
- Historical re-rating of rows that already have a base equivalent.
- Any change to the bot, API or web surface beyond the shared client.

## Decisions

### Frankfurter v2 pair endpoint

The client calls `https://api.frankfurter.dev/v2/rate/<base>/<quote>?date=<date>`, which returns `{ date, base, quote, rate }`. This replaces the v1 `rates` object parse with a flat rate. v2 blends 104 official sources and covers UAH, and the same provider already handles every other currency in use, so no second provider is added. Alternative: keep v1 for ECB currencies and add the National Bank of Ukraine for UAH, which adds a provider branch and a second failure mode for no benefit now that one source covers both.

### Blended rate, no provider filter

The default v2 feed is blended across providers, which keeps one request shape and one cached value per date. v2 can scope to a single provider with `providers`, which would give the official NBU rate for UAH, but it also adds a per-currency branch and a second response shape to test. Since the goal is a usable base equivalent, not an auditable official conversion, the blended rate is enough. The chosen provider stays recorded in `exchange_rates.source` as `frankfurter-v2`, so a later move to provider scoping has a clean starting point.

### Cache and fallback unchanged

`getRate` keeps its lookup order: exact cached date, then fetch, then nearest earlier cached rate, then null. Only `fetchFrankfurter` changes. Request volume stays as it is: one fetch per `(base, quote, date)` on a cache miss, so a backfill across 34 UAH expenses costs one request per distinct date, once.

### Backfill as a CLI entry point

A new `bot/src/cli/backfill-rates.ts`, run with `npm run backfill:rates`, reads expenses whose `base_amount_minor` is null, resolves the rate for each expense date through `getRate`, and writes the base amount, currency, rate and rate date through the existing `updateExpense`. Reusing the store method and the same rate client means the backfill cannot diverge from the write path. Alternative: a SQL-only backfill, which would duplicate the conversion logic and lose the cache.

### Bank name in the mapping prompt

The mapping prompt asks the model for the bank name from the headers and sample and stores it on the profile. The strict schema already carries `bank`, so this is a prompt change, not a schema change. Existing profiles keep their stored value.

## Risks / Trade-offs

- The v2 response shape differs from v1, so a wrong parse would silently return no rate. Mitigated by validating the parsed fields and a test with a stubbed v2 response and by keeping the source string in `exchange_rates`.
- v1 is deprecated, so leaving it in place is itself a risk. This change removes the v1 URL entirely.
- A blended rate can differ slightly from an official one and from the bank's card rate. Acceptable for a base equivalent; the original amount and currency are untouched.
- The public v2 instance is rate-limited to prevent abuse but has no quota. The cache keeps the call count per date, and the client already has a 5-second timeout and a nearest-earlier fallback.
- The backfill writes to existing expense rows. Mitigated by only touching rows with an empty base, writing the four fields together, and reporting unresolved rows.
- The bank name still depends on the model. Mitigated by the field staying nullable; a null bank degrades to the current behavior.

## Migration Plan

1. Switch `fetchFrankfurter` to the v2 pair endpoint and adjust the tests.
2. Add the null-base read and the backfill CLI.
3. Run the backfill against the local database and confirm the UAH expenses gain a base amount and the dashboard total rises.
4. Adjust the mapping prompt for the bank name.

Rollback is a revert of the commit. The backfill writes base fields only; a revert leaves the filled values in place, which is harmless because they are correct. No schema change is involved.

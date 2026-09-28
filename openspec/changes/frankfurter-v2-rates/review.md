# Review

Independent review of the branch against `main` before the PR, run with the reviewer subagent.

## Findings and dispositions

### 1. Docstring contradicted the code (low) — applied

`shared/src/fx.ts`. The comment said rows that already have a base amount are left alone and reported unresolved, but the query only returns rows with an empty base. Reworded to describe returned rows only.

### 2. Identity short-circuit was case-sensitive (low) — applied

`shared/src/fx.ts`. `base === quote` is now `base.toUpperCase() === quote.toUpperCase()`, so a case difference no longer forces a network fetch.

### 3. Validation accepted a non-positive rate and a non-string date (low) — applied

`shared/src/fx.ts`. The check now rejects a rate that is not a finite number greater than zero and a date that is not a non-empty string, and a test covers a zero rate.

### 4. The backfill CLI has no catch and loads unrelated env vars (low) — declined

`bot/src/cli/backfill-rates.ts`. It matches the existing import CLI shape, which also relies on the full config. A fetch failure does not throw, so an unhandled rejection is unlikely. Left consistent rather than special-casing one CLI.

### 5. `updateExpense` bumps `updated_at` on filled rows (nit) — declined

`shared/src/fx.ts`. That is a legitimate write and `updated_at` is not surfaced as a user-facing modification time. No change.

### 6. A second run re-attempts unresolved rows (nit) — declined

`shared/src/fx.ts`. Intended: unresolved rows are left for a later backfill, and a fetch failure is not cached, matching `getRate`'s existing behavior.

### 7. The delta requirement overlaps the existing Money and currency requirement (nit) — no action

`openspec/changes/frankfurter-v2-rates/specs/data-model/spec.md`. The additions are consistent with the code and merge into the main spec on archive, following the repo's archive-and-sync pattern.

## Verdict after fixes

No correctness bugs found in the rate client or the backfill. The three low findings worth acting on are applied; the rest are declined with a reason or confirmed as intended.

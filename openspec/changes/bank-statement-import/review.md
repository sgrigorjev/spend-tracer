# Review

Independent review of the branch against `main` before the PR, run with the reviewer subagent.

## Findings and dispositions

### 1. Row fingerprint always included the row sequence (high) — applied

`shared/src/import/profile.ts`, `fingerprint.ts`. The sequence was hashed even when a running balance identifies the row, so an overlapping statement with a different row offset would store a duplicate. Fixed: the fingerprint uses the sequence only when there is no balance, so account, date, amount, currency, description and balance alone identify the row. Covered by the new "row fingerprint ignores position when a balance identifies the row" test.

### 2. Zip-bomb guard inflated before the size check (high) — applied

`shared/src/import/zip.ts`. The check ran after `inflateRawSync`, so a single entry could exhaust memory first. Fixed: the central-directory uncompressed size is checked before inflating, and `inflateRawSync` is capped with `maxOutputLength`.

### 3. No family-boundary authorization on linking (medium) — applied

`shared/src/import/pipeline.ts`. A host-supplied merge target was trusted without re-checking family membership, and `unlinkTransaction` took an arbitrary expense id. Fixed: `assertLinkAllowed` verifies the expense is the importer's or an active family member's, on both link and unlink. Covered by the "unlink refuses an expense outside the importer's family" and "candidate lookup never returns an outside-family expense" tests.

### 4. Debit/credit-only profiles validated but failed to parse (medium) — applied

`shared/src/import/profile.ts`. The validator accepted a mapping with only debit and credit columns, but the amount was read only from amount or account_amount. Fixed: the amount falls back to the debit and credit cells. Covered by the new debit/credit test.

### 5. `sign` accepted any value and `prefer` was dead (medium) — applied

`shared/src/import/profile.ts`. Fixed: `sign` is validated against the three allowed values, `prefer` is validated against `transaction` and `account`, and `prefer: account` now selects the account-currency amount.

### 6. Impossible calendar dates accepted (low) — applied

`shared/src/import/profile.ts`. Fixed: `assemble` round-trips through `Date.UTC` and range-checks the time parts. Covered by the "impossible calendar date is rejected" test.

### 7. Balance reconciliation uses one account key when no account column exists (low) — declined

Without an account or card column a multi-account statement cannot be grouped, so treating its balances as one sequence and refusing is the safer default. Every export seen so far carries a card column. Revisit if a real multi-account export without an account column appears.

### 8. Tasks marked done with tests still missing (low) — partly applied

Added tests for the family boundary, the middle band, debit/credit parsing, bad dates and the fingerprint shift. The enrichment keep-the-user-value test (6.6), the oversized and macro-enabled XLSX tests (4.3) and the scripted CLI transcript (6.9) are not written yet; those tasks are unchecked again in `tasks.md`.

### 9. `appendStatement` stores a row even when every transaction is deduped (low) — declined

Harmless: statement rows are metadata, transaction idempotency is what the spec relies on, and a repeated statement record is useful history. Not worth a unique constraint.

### 10. N+1 participant queries in the API list (low) — declined

The page is capped at 100 rows and the query is local SQLite, so this is not worth a batch method now. Noted for later.

### 11. Owner's list shows a shared expense that is excluded from their aggregates (low) — declined

This matches the agreed attribution rule (confirmed payer wins, the other participant sees it marked shared but not counted). The list already returns `shared` and the participants, so a UI hint is a frontend follow-up, not a backend fix.

## Verdict after fixes

The two high findings and the family-boundary finding are resolved with tests. Remaining items are low and either declined with a reason or tracked as open tasks.

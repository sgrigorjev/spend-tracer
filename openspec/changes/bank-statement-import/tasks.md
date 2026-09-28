## 1. Schema and store

- [x] 1.1 Add `bank_statements`, `bank_transactions`, `import_profiles`, `expense_participants` and `expense_events` to `CREATE_TABLES` in `shared/src/db.ts`, and widen the `expenses.source` check to include `import`; verify `createStore(":memory:")` creates every table and `npm run typecheck` in `shared/` is clean
- [x] 1.2 Add indexes and uniqueness for candidate lookup and idempotency: unique `(user_id, fingerprint)` on `bank_transactions`, unique `(user_id, fingerprint)` on `import_profiles`, unique `(expense_id, user_id, role, origin)` on `expense_participants`, and an index on `bank_transactions(user_id, resolved_state)`; verify the indexes exist in a fresh in-memory store
- [x] 1.3 Add the new row and insert types plus the store method signatures (statements, transactions, profiles, participants, events) to the `Store` interface; verify `npm run typecheck` in `shared/` is clean
- [x] 1.4 Delete the local `data/*.db` and confirm the bot and the API both start against the recreated schema; verify both processes boot without a schema error

## 2. Store write paths

- [x] 2.1 Make `appendExpense` write the recorder participant for the owner and append a `created` event in the same transaction; verify a test that inserting an expense leaves one recorder participant and one event
- [x] 2.2 Add participant methods to attach and remove a participant with role, origin and confidence, keeping the higher-confidence record when the same role arrives from a different origin; verify a test that a bot assumed payer followed by an import confirmed payer keeps both facts
- [x] 2.3 Add an append-only event method and a list method scoped to an expense; verify a test that events are ordered and never updated
- [x] 2.4 Add statement and transaction insert methods that skip a row whose fingerprint already exists for the user; verify a test that importing an overlapping set stores only the new rows
- [x] 2.5 Add profile read, upsert and update methods scoped to the user, with `status`, `last_used_at` and `use_count`; verify a test that two users can hold the same fingerprint independently
- [x] 2.6 Add methods to set and clear a transaction's resolution (expense link, created, ignored, unmatched); verify a test that a resolved transaction reports its resolution and an undone one returns to unmatched

## 3. Shared normalization

- [x] 3.1 Move the record-to-expense normalization from `bot/src/confirm.ts` into `shared/src` and adapt the bot to call it; verify the bot tests and `npm run typecheck` pass
- [x] 3.2 Define the import profile type (role to column map, directives, status) with a runtime validator that accepts only known roles, known directives and column references; verify a unit test rejects an unknown role or an embedded expression

## 4. Statement parsing

- [x] 4.1 Add content-based file kind detection that ignores a misleading extension; verify tests over a small committed CSV and XLSX fixture
- [x] 4.2 Add a CSV reader with delimiter and encoding detection; verify tests over a semicolon and a comma fixture, including a non-UTF-8 file
- [ ] 4.3 Add an XLSX reader that enforces a file size limit, rejects macro-enabled workbooks and never evaluates formulas; verify tests over a valid fixture, an oversized file and a macro-enabled file (reader implemented and exercised on a valid fixture; the oversized and macro-enabled tests are still to add)
- [x] 4.4 Route PDF and image statements through the model document path to a mapping and the same verification gate; verify a fixture PDF produces a mapping and that an unreadable file is refused
- [x] 4.5 Apply a profile to parse rows into normalized transaction drafts, choosing the transaction-currency amount as authoritative and supporting signed, direction-column and separate debit and credit shapes; verify tests for each shape
- [x] 4.6 Classify each row as outflow, inflow or transfer, including own-card transfers; verify tests that a purchase is an outflow and a salary credit and a self-transfer are not
- [x] 4.7 Compute the row fingerprint from account, date, amount, currency, description and running balance, falling back to the statement sequence when no balance exists, and log every skipped row; verify a test that a duplicate within one import is skipped and logged
- [x] 4.8 Add the parse integrity check against the statement totals or balance sequence and refuse the import with nothing written on failure; verify a test that a tampered file is refused and stores nothing

## 5. Profile learning and verification

- [x] 5.1 Implement the format fingerprint over normalized sorted headers, column count, file kind and sample signature; verify a test that reordered columns match and a changed header set does not
- [x] 5.2 Implement profile generation calling the model with headers and a bounded sample only, under a strict schema; verify a test with a stubbed model that the payload excludes full rows and the output validates
- [x] 5.3 Implement invariant verification: every date and amount parses, currencies are ISO-4217, and consecutive balances reconcile per account; verify tests for a passing profile, a bad date and a broken balance
- [x] 5.4 Implement the draft and verified lifecycle with the CLI preview and confirmation; verify a test that a draft is not applied to a second file until confirmed and that a confirmed profile applies automatically
- [x] 5.5 Enforce per-user profile scope and reject applying another user's profile; verify a test that a second user with the same fingerprint goes through detection instead

## 6. Reconciliation

- [x] 6.1 Implement the candidate query limited to active family members, matching amount in the transaction currency and a bounded date window, excluding rejected expenses; verify tests including an outside-family expense being excluded
- [x] 6.2 Implement candidate scoring from date proximity, description similarity and amount exactness; verify unit tests on known pairs
- [x] 6.3 Implement the bands: auto-link a high unique score, ask a middle score or several close candidates, create a new expense when none is plausible; verify tests for each branch
- [x] 6.4 Implement automatic linking as one atomic write of the transaction link, the payer and confirmer participants and the event; verify a test that a failure writes nothing
- [x] 6.5 Add the family boundary authorization on linking and refuse a link to a non-member's expense; verify a test that a cross-family link is refused and changes nothing
- [ ] 6.6 Implement enrichment that attaches the transaction card and bank to the expense detail without overwriting user-entered values; verify a test that a user value is kept (card data is stored on the transaction; the explicit keep-the-user-value test is still to add)
- [x] 6.7 Implement undo of a link that detaches the transaction, removes the participants the link added and returns the transaction to unmatched; verify a test that it can then be rematched
- [x] 6.8 Make reconciliation skip resolved transactions so a re-import produces no second expense, link or prompt; verify a test that a second run is a no-op
- [ ] 6.9 Implement the interactive CLI decision for an uncertain match with merge, create separate and ignore, persisting the choice; verify a scripted transcript that each choice is honored and not repeated (the CLI handler is implemented; a scripted transcript test is still to add)

## 7. Reporting

- [x] 7.1 Make the expense reads scope-aware so a participant sees a shared expense they do not own, and surface participants and the shared marker on the list; verify route tests
- [x] 7.2 Apply the attribution rule in the aggregates: confirmed payer wins, recorder is the fallback, a non-payer participant's aggregates exclude the shared expense and the family total counts it once; verify summary tests

## 8. Verification

- [x] 8.1 Run `npm run typecheck` in `shared/`, `bot/` and `api/`; verify all are clean
- [x] 8.2 Run the targeted tests for db, parsing, profiles, reconciliation and reporting; verify they pass
- [x] 8.3 Run the real PrivatBank XLSX through the CLI end to end: the first run learns and confirms a profile, the second reuses it and reconciles, and no duplicate expenses result; verify the event log records creation and any links (both runs done on the real file: 374 parsed, 323 created, 51 ignored, then 374 skipped with the profile reused)
- [x] 8.4 Run a security pass over untrusted file parsing, profile generation input and cross-family authorization, and record findings with dispositions in `review.md`; verify each finding is applied or declined with a reason (reviewer subagent plus two CodeRabbit rounds; every finding recorded in `review.md` with its disposition)

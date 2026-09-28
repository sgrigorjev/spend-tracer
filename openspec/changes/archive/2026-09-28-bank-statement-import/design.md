## Context

See proposal.md for motivation. The current state that shapes this design:

- Expenses live in one SQLite database opened by both the bot and the API through the shared store in `shared/src/db.ts`. The only insert path is `appendExpense` and it has no uniqueness or reconciliation key.
- `expenses.source` is constrained to text, photo and voice, and the check constraint has to change to admit import.
- There is no migration framework, only `CREATE TABLE IF NOT EXISTS`, but both databases are effectively empty, so the schema can be recreated rather than migrated.
- The bot is the only writer of expenses. The API reads them and is scoped strictly to the signed-in user id, not to family visibility.
- `recordToExpense` in `bot/src/confirm.ts` is the normalization path from an extracted record to an expense, but it depends on the bot config and is not reusable from elsewhere.
- The real PrivatBank export is an XLSX with a header row, per-card running balances, and two amounts per row (account currency and transaction currency), which is enough to design against a concrete case.

## Goals / Non-Goals

**Goals:**

- A parsing and reconciliation core that lives in shared code and is driven by a CLI first, so the bot and the API can reuse it later.
- A learned, declarative, per-user import profile for a bank format, reused without the model once verified.
- One canonical expense for a purchase that appears both in a bot message and in a statement, with the people involved recorded.
- Idempotent re-import and reversible reconciliation.

**Non-Goals:**

- Built-in hand-written adapters for specific banks, including PrivatBank. The first pass uses the learned-profile path so its behavior can be observed.
- Standard account formats, OFX, QIF, CAMT.053, MT940.
- Telegram document upload, inline confirmation buttons, and the web upload and review screen.
- Splitting an expense amount between participants, or per-participant shares.

## Decisions

### Raw transactions are separate from expenses

Imported rows are stored in `bank_transactions` and never written directly into `expenses`. Reconciliation links a transaction to an expense, or creates one. The alternative, folding every imported row into `expenses` with `source = import`, is tempting because it needs no new read path, but it makes re-import and undo painful: deduplication needs a stable key anyway, correcting a wrong match means merging or deleting expense rows, and the raw statement row and its provenance are lost. Keeping the raw rows is what makes the rest of the design, idempotency and undo, straightforward.

### Declarative profile with a fingerprint key

A profile maps semantic roles to column or field names, plus parsing directives (date format, decimal and thousands separators, sign convention, which amount is authoritative) and a status. The key is a fingerprint over the normalized, sorted header set, the column count, the file kind and a signature of the sample data. Headers are referenced by name, not index, so a bank reordering columns does not invalidate a profile. Storing no executable content keeps the profile reviewable and safe to apply to future files.

Alternatives considered: storing the model's prompt and re-running it per file, which is non-deterministic and costs tokens on every import; storing generated code, which is a code-execution surface and cannot be validated as easily as a fixed set of roles and directives.

### The model bootstraps a profile, it does not parse

The model receives the header row and a bounded sample of rows, or the rendered document for PDF and image input, and returns a mapping under a strict schema, like the existing extraction in `bot/src/openai.ts`. It never sees the whole file and never participates in matching. This keeps cost and latency bounded and confines non-determinism to the one step a human confirms.

### Invariant verification gates a new profile

A freshly generated profile is applied and checked before it can be trusted: every row yields a parseable date and amount, currencies are valid ISO-4217, and, when a balance column is mapped, consecutive balances reconcile per card. The balance sequence is the strongest available signal, since a mis-mapped amount or balance column breaks it immediately. A profile that fails stays draft and is never applied to later files until the user confirms a preview. This gate is load-bearing precisely because PrivatBank, the main test case, goes through the learned path.

### Profiles are per user

A profile belongs to the user who created it and is never applied to another user's files. This is a tenancy boundary, not just privacy: a shared profile store lets one user generate a mapping that later mis-parses another user's statement, so per-user scope confines the blast radius of a bad or hostile profile to its author. The cost is that a second user of the same bank learns the format once more, which is cheap. The profile format stays serializable so a verified profile can be promoted to a hand-written adapter later.

### Reconciliation is family-scoped and rule-based

Candidate expenses are limited to active members of the importing user's family, matched on amount in the transaction currency and a bounded date window, then scored by date proximity, description similarity and amount exactness. A high unique score links automatically; a middle score or several close candidates asks; no plausible candidate creates a new expense. The family boundary is a hard authorization check on both candidate selection and link creation, so a crafted import cannot attach to an outside user's expense. Token similarity is used for descriptions rather than embeddings, because the candidate set is already small and exact, which keeps matching deterministic and testable. The model is not used for matching.

### Participants are explicit, expenses keep their owner

An expense keeps `expenses.user_id` as the primary owner, mirrored as a recorder participant, and gains `expense_participants` rows with a role of recorder, payer or confirmer, an origin of bot, import or manual, and a confidence. A bot-recorded expense creates a recorder and an assumed payer, because at record time the payer is unknown. An import adds a confirmed payer and a confirmer without removing the recorder. The alternative, a single owner with no participant table, cannot represent two people on one expense, and splitting the amount is left for later by keeping the role rows flexible. `expenses.user_id` is kept in sync with the recorder participant in the single write path, so existing reads against `user_id` keep working.

### The transaction link and the participants are written atomically

`bank_transactions.expense_id` records which expense a transaction resolved to, which answers idempotency questions cheaply, while participants record who is involved. Reconciliation sets both in one store transaction, and undo clears both, so the two never drift.

### Transaction fingerprint for idempotency

Each row gets a fingerprint over account, date, amount, currency, description and running balance. A re-import of an overlapping statement then stores no duplicate rows. When no balance is available the fingerprint falls back to a per-statement sequence, which is weaker but still prevents double-counting within an import.

### Card data stays on the transaction

The masked card and bank come from the statement and are stored on `bank_transactions`, surfaced on the expense detail through the link. They are not added as columns on `expenses`, which keeps bank-specific fields out of the expense model until card-level reporting is wanted.

### Shared code, CLI first

The parser, profile handling, normalization and matcher live in `shared/src` so the CLI and the bot share one implementation. The normalization currently in `bot/src/confirm.ts` moves to shared so both paths use it. The CLI importer is the first entry point, so the behavior can be exercised interactively before a chat surface wraps it.

### Schema recreation, not migration

New tables are added to `CREATE_TABLES` and the `source` check constraint is widened. The databases are recreated. Rollback is a revert of the commit and a rebuild of the database.

## Risks / Trade-offs

- A mis-generated profile writes wrong amounts → Invariant verification, draft status, and a user-confirmed preview before any reuse. The verified profile is the only one applied automatically.
- Prompt injection through statement content manipulates the mapping → The model sees only headers and a bounded sample, returns only a fixed schema of role and column references, and any candidate mapping still passes invariants and user confirmation. Per-user profiles confine a hostile profile to its author.
- Parsing an untrusted XLSX or PDF is an attack surface (zip bombs, huge files, macros) → Enforce a file size limit, read in a streaming or bounded way, reject macro-enabled workbooks, and never evaluate formulas.
- Formula injection if parsed values are ever re-exported → Never evaluate cell formulas on read, and neutralize leading formula characters on any future export.
- The transaction fingerprint could drop a genuine distinct row that collides → Include the running balance and the full timestamp, and when no balance exists include the statement sequence. Log every skipped row so a collision is visible.
- Auto-link could merge two genuinely different similar purchases → Require a high threshold and a unique best candidate, ask when several are close, and make undo available.
- A link could be created across families → Authorize candidate selection and link creation against active family membership, and refuse otherwise.
- Family membership changes after a link (a participant leaves) → The link and participant rows stay, but visibility follows current membership, so an ex-member stops seeing the expense; the owner is unaffected.
- Matching amounts across currencies → Compare in the transaction currency, which is the amount the user actually spent, not the account-currency debit.
- Recreating the database destroys data → Acceptable while the databases are empty; the recreation must happen before any real server data exists. Called out as a release-time check.
- Candidate queries get slow as expenses grow → Index the candidate lookup on user and date, and bound the date window and candidate count.

## Migration Plan

1. Add the new tables to `CREATE_TABLES` in `shared/src/db.ts` and widen the `source` check to include import.
2. Recreate the local and server databases. Confirm no real data exists on the server first.
3. Ship the shared parser, profile store, matcher and the CLI importer.
4. Wire reconciliation into the bot as a follow-up change; nothing here depends on it.

Rollback is a revert of the commit plus deleting and recreating the database. No data migration is involved.

## Open Questions

- The exact date window, score thresholds and description-similarity measure are tunable constants, to be set by testing against the real PrivatBank statement. They do not change the specs or the approach.
- Whether the user's category mapping from bank categories to the existing nine categories is a fixed table or also learned. A fixed table is the starting point; this can be revisited without changing the approach.

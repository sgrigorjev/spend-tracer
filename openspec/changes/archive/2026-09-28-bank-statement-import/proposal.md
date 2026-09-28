## Why

The only way an expense enters the system today is a message to the bot (text, receipt photo or voice), so the same purchase can be recorded twice: once by the person who paid at the till, again when a bank statement is imported, and neither record knows about the other. Bank statements are the ground truth for what actually left an account and with which card, but they are unstructured per-bank files. This change adds statement import and reconciles imported transactions with expenses already recorded, including the common case where one family member pays with another member's card.

## What Changes

- Import a bank statement file, detect its format, and turn its rows into normalized transactions.
- Learn a reusable import profile when a format is new: the mapping is generated once, verified against invariants, confirmed by the user, and reused for later files from the same bank. Profiles are scoped to the user who created them.
- Keep the imported rows as raw, immutable transactions separate from expenses so re-imports are idempotent and a bad match can be undone.
- Reconcile each imported transaction against existing expenses within the importing user's family: link a clear match, ask the user when a match is uncertain, and create a new expense when there is none.
- Record who is involved in an expense with explicit roles (recorder, payer, confirmer), so a payment made with another member's card shows one expense with two participants instead of two copies.
- Enrich a reconciled expense with the card and bank data carried by the matched transaction.
- Keep a per-expense event log of how it was created, matched, enriched, and changed.
- Add an offline CLI importer as the first entry point, so the parsing and matching behavior can be exercised before it is wired into a chat surface.
- Add the `import` value to the expense source and the new storage tables.

## Capabilities

### New Capabilities

- `bank-import`: reading statement files (CSV, XLSX, PDF or image), resolving a declarative per-user import profile by format fingerprint, generating a profile with the LLM when the format is unknown, verifying it against invariants, confirming it with the user, and parsing rows into normalized transactions.
- `expense-reconciliation`: matching imported transactions to existing expenses within a family, linking a clear match, asking on an uncertain one, creating an expense on no match, tracking participant roles, making re-import idempotent, and allowing a match to be undone.

### Modified Capabilities

- `data-model`: storage for statements, imported transactions, import profiles, expense participants and expense events; the `import` expense source.
- `expense-reporting`: attribution of a shared expense to a confirmed payer, falling back to the recorder, with the family total counting each expense once.
- `family-sharing`: reconciliation and co-ownership within one family, and member-scoped reads that account for participants.

## Impact

- `shared/src/db.ts`: new tables in `CREATE_TABLES`, the `import` source value, participant and event write paths, and profile and transaction storage. The database is recreated, not migrated.
- `shared/src/`: the profile format, normalization of parsed rows, and the matching and scoring rules live here so the CLI and the bot share them.
- `bot/src/`: a new CLI entry point for the importer; the parser and matcher are reused by a later Telegram document handler.
- `api/src/routes/expenses.ts`: reads become scope-aware and participants are surfaced on the expense list and detail.
- `openspec/config.yaml`: the storage note still claims separate bot and API databases; both open one file.

Out of scope for this change and left for follow-ups: the Telegram document upload and inline confirmation buttons, the web upload and review screen, built-in hand-written adapters for specific banks, standard account formats (OFX, QIF, CAMT.053, MT940), and splitting an expense amount between participants.

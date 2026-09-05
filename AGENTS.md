# AGENTS.md

## Keeping this file current

When you learn something new about this project, its setup, or the developer's
preferences, propose adding it to or updating AGENTS.md. Do not edit the file
on your own; suggest the change and let the developer approve it.

## Commands

- TypeScript runs natively (Node 22.18+, type stripping): no build step, imports use
  explicit `.ts` extensions (tsconfig: allowImportingTsExtensions). Keep it that way.
- Run `npm run typecheck` after any change, before opening a PR.
- `npm test` runs node:test. Most tests call the real OpenAI API, spend tokens and need
  `.env` with OPENAI_API_KEY plus ffmpeg on PATH. Prefer targeted runs
  (`node --test test/<file>.test.ts`, e.g. test/db.test.ts); run the full suite only when
  the change warrants it.

## Runtime & data

- Config comes from `.env`. Required: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY. Optional:
  DB_PATH (default data/spend-tracer.db) and model overrides.
- Expenses and the raw message log live in a local SQLite DB (built-in `node:sqlite`,
  ExperimentalWarning on startup is expected; do not add SQLite dependencies). All writes
  go through the store in src/db.ts (ExpenseStore): tables `messages` and `expenses`,
  `appendExpense` returns a numeric row id used for later status/field updates.
- High-confidence expenses are written automatically; uncertain ones are inserted as
  `pending` and confirmed via inline buttons ("Записать / Изменить / Отмена"). Pending
  rows survive restarts in the DB; only the button state is in memory.
- data/ and downloads/ are gitignored runtime dirs; never commit their contents.
  google-service-account.json and the Google keys in .env are unused leftovers from the
  old Google Sheets backend; leave them alone.
- Quick map: src/bot.ts pipeline, src/openai.ts LLM extraction, src/transcribe.ts voice,
  src/confirm.ts confirmation flow, src/expenseSchema.ts prompts, src/db.ts storage.

## Conventions

- Open a PR for every change: short branch off main, small scope, concise English summary
  in the description. Never commit to main directly. This is a personal repo, PRs are
  small and merged quickly.
- Comments, commit messages and PRs are written in English. Match the existing code style
  (doc comments, 120-column lines, sync sqlite calls).

## Prose

Always run the unslop skill (.claude/skills/unslop/SKILL.md) before writing text that
other people will read: PR titles, descriptions and comments; commit messages; project
docs and in-code comments and docstrings; AGENTS.md itself; chat replies. Skip it only
for one-line acknowledgements, code identifiers, log and exception strings, and
mechanical output.

# AGENTS.md

## Keeping this file current

When you learn something new about this project, its setup, or the developer's
preferences, propose adding it to or updating AGENTS.md. Do not edit the file
on your own; suggest the change and let the developer approve it.

## Prose

Always run the unslop skill (.claude/skills/unslop/SKILL.md) before writing text that
other people will read: PR titles, descriptions and comments; commit messages; project
docs and in-code comments and docstrings; AGENTS.md itself; chat replies. Skip it only
for one-line acknowledgements, code identifiers, log and exception strings, and
mechanical output.

## Commands

- TypeScript runs natively (Node 22.18+, type stripping): no build step, imports use
  explicit `.ts` extensions (tsconfig: allowImportingTsExtensions). Keep it that way.
- Run `npm run typecheck` from `bot/` after any change, before opening a PR.
- `npm test` runs node:test from `bot/`. Most tests call the real OpenAI API, spend tokens
  and need the root `.env` with OPENAI_API_KEY plus ffmpeg on PATH. Prefer targeted runs
  (`node --test test/<file>.test.ts`, e.g. test/db.test.ts); run the full suite only when
  the change warrants it.

## Browser preview

`opencode.json` registers the Playwright MCP so the agent can render and inspect UI in a
real browser. It launches headed on the bundled Chromium (`--browser chromium`), because WSL
has no system Chrome and the MCP defaults to that channel, and headed mode lets you sign in
interactively. A machine without a display must pass `--headless` locally. Page snapshots go
to `.playwright-mcp/`, which is gitignored.

With the web container up, mockups are served at `http://127.0.0.1:8001/mockups/*.html`.
Writing screenshots into `web/mockups/` makes them viewable over that same URL, since
nginx already serves the folder.

The MCP pins a Playwright alpha, so its Chromium revision drifts when the package updates.
Reinstall the browser with the MCP's own command:

```sh
npx -y @playwright/mcp@latest install-browser chromium
```

### Signed-in API access

The MCP profile is persistent, under `~/.cache/ms-playwright-mcp/`, so cookies survive MCP
restarts. `SESSION_MAX_AGE` in `.env` makes the API session cookie persistent too, set to 30
days locally. Together they let the agent call the authenticated API without a fresh sign-in
on every run.

1. The agent opens `http://127.0.0.1:8001/login` in the Playwright browser.
2. You sign in with Google in that window. The agent cannot do this step.
3. The agent verifies the session with `GET /api/auth/me` and then uses the API as you.

When a call returns 401, the session is missing or expired. Offer to repeat the sign-in
instead of failing. The Google cookies usually survive, so it is one click.

The MCP profile holds your Google cookies. Keep it local, never commit it, never share it.

## Runtime & data

- Config comes from the root `.env`. Required: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY. Optional:
  DB_PATH (default data/spend-tracer.db) and model overrides.
- Expenses and the raw message log live in a local SQLite DB (built-in `node:sqlite`,
  ExperimentalWarning on startup is expected; do not add SQLite dependencies). All writes
  go through the store in bot/src/db.ts (ExpenseStore): tables `messages` and `expenses`,
  `appendExpense` returns a numeric row id used for later status/field updates.
- High-confidence expenses are written automatically; uncertain ones are inserted as
  `pending` and confirmed via inline buttons ("Записать / Изменить / Отмена"). Pending
  rows survive restarts in the DB; only the button state is in memory.
- data/ and downloads/ are gitignored runtime dirs; never commit their contents.
  google-service-account.json and the Google keys in .env are unused leftovers from the
  old Google Sheets backend; leave them alone.
- Quick map: bot/src/bot.ts pipeline, bot/src/openai.ts LLM extraction,
  bot/src/transcribe.ts voice, bot/src/confirm.ts confirmation flow,
  bot/src/expenseSchema.ts prompts, bot/src/db.ts storage.

## Conventions

- Open a PR for every change: short branch off main, small scope, concise English summary
  in the description. Never commit to main directly. This is a personal repo, PRs are
  small and merged quickly.
- Comments, commit messages and PRs are written in English. Match the existing code style
  (doc comments, 120-column lines, sync sqlite calls).

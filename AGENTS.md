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

Verify UI changes by the actual render, not by DOM presence: take a screenshot or read `getComputedStyle` and element geometry with the page tools. An element can be present in the accessibility tree and still be invisible (an invalid `stroke` or `color`), clipped, or overlapped by a sibling.

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
  DB_PATH (default data/spend-tracer.db), BASE_CURRENCY (default EUR, fixed for the whole
  database) and model overrides.
- Expenses and the raw message log live in one local SQLite DB shared by the bot and the
  API (built-in `node:sqlite`, ExperimentalWarning on startup is expected; do not add
  SQLite dependencies). The schema and store live in `shared/src/db.ts`, re-exported by
  `bot/src/db.ts` and `api/src/db.ts`. Tables: `users`, `identities`, `expenses`,
  `messages`, `link_tokens`, `exchange_rates`, `families`, `family_members`.
  `appendExpense` returns a numeric row id used for later status/field updates.
- High-confidence expenses are written automatically; uncertain ones are inserted as
  `pending` and confirmed via inline buttons ("Записать / Изменить / Отмена"). Pending
  rows survive restarts in the DB; only the button state is in memory.
- The bot records only senders whose Telegram account is linked to a registered user.
  Unlinked senders get a single onboarding reply and nothing is stored for them.
- data/ and downloads/ are gitignored runtime dirs; never commit their contents.
- Quick map: bot/src/bot.ts pipeline, bot/src/openai.ts LLM extraction,
  bot/src/transcribe.ts voice, bot/src/confirm.ts confirmation flow,
  bot/src/expenseSchema.ts prompts, shared/src/db.ts storage,
  api/src/routes/{auth,telegram,family,dashboard}.ts endpoints.

## Code review

Before opening a PR, run the review by spawning the `reviewer` subagent: the Task tool with `subagent_type: reviewer`, or `@reviewer` in the TUI. Do not run `opencode run --command review` from the shell; that starts a fresh top-level session where the command executes in the primary agent, so the subagent never runs and the pass is not independent. The reviewer never edits, it only reports findings as severity, `file:line`, reason and fix.

Record the outcome in `openspec/changes/<name>/review.md`: every finding with its disposition, applied in a commit or declined with one concrete reason. The file travels with the change into the archive, so the review leaves a durable trace rather than living only in chat.

## PR watching

`pr-watch` is an external skill (from `claude-settings`) written for a different setup: it assumes a blocking `/loop`, which this environment does not have. Use it with care here.

- Never block the session on CI or CodeRabbit. No `gh pr checks --watch` and no `timeout ... gh pr checks` in the session. Watch in the background instead (a detached `setsid` poller, or a background subagent when `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS` is on) and report on demand.
- The required gates are `gitleaks` and `semgrep`, enforced by the GitHub ruleset. CodeRabbit is not a required check.
- Check CodeRabbit only when the PR is otherwise ready to merge. Its state is a commit status, not a check run, and only the `Review completed` description is an actual review; `Review skipped` and `Review rate limited` are not. The free plan allows roughly one review per hour, so an eager loop exhausts it. On a rate limit, stop polling and let the developer decide.

## Conventions

- Open a PR for every change: short branch off main, small scope, concise English summary
  in the description. Never commit to main directly. This is a personal repo, PRs are
  small and merged quickly.
- A PR that archives a change (moves `openspec/changes/<name>/` to `openspec/changes/archive/`) always gets the `ignore-for-release` label, so archive churn stays out of the auto-generated release notes. See `.github/release.yml`.
- Assign every PR to its creator (`sgrigorjev`) when opening it.
- Label every PR with the release-notes category from `.github/release.yml` that fits (`enhancement`, `bug`, `chore`, `documentation`, `dependencies`), so the auto-generated notes group it.
- Comments, commit messages and PRs are written in English. Match the existing code style
  (doc comments, 120-column lines, sync sqlite calls).

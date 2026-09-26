# Spend Tracer

A Telegram bot that turns chat messages, receipt photos and voice messages into structured expense records in a local SQLite database, using OpenAI.

## Features

- Extracts expenses from plain text ("Платил 12 евро за продукты") via LLM structured output
- Reads totals from receipt/purchase photos (vision)
- Transcribes voice messages (Whisper) and extracts the expense from the transcript
- Detects silent voice messages and notifies the chat instead of transcribing
- Hybrid confirmation: high-confidence expenses are written automatically, uncertain ones get a "Записать / Изменить / Отмена" inline prompt
- Records every message in a raw log table, expenses in a dedicated `expenses` table
- Graceful shutdown on `SIGINT` / `SIGTERM`

## Requirements

- Node.js 22.18+ (runs TypeScript natively via type stripping; `node:sqlite` needs 22.13+)
- [ffmpeg](https://ffmpeg.org) on PATH (audio preprocessing and silence detection; the bot still works without it, just skips the silence check)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An [OpenAI](https://platform.openai.com) API key

## Setup

`npm install` and `npm start` run from the `bot/` directory. The `.env` file lives at the repo root.

1. Install dependencies:

   ```sh
   npm install
   ```

2. From the repo root, create a `.env` file (see [`.env.example`](.env.example)):

   ```sh
   cp .env.example .env
   ```

3. Fill in the variables (see [Configuration](#configuration)).
4. Start the bot:

   ```sh
   npm start
   ```

   For a dev loop with auto-restart: `npm run dev`.

## Configuration

| Variable                        | Description                                                          |
| ------------------------------- | -------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`            | Token obtained from @BotFather                                       |
| `OPENAI_API_KEY`                | OpenAI API key                                                       |
| `DB_PATH`                       | Path to the SQLite database file (default `data/spend-tracer.db`)    |
| `OPENAI_MODEL_TEXT`             | Text/voice extraction model (default `gpt-4o-mini`)                  |
| `OPENAI_MODEL_VISION`           | Receipt-photo vision model (default `gpt-4o-mini`)                   |
| `OPENAI_TRANSCRIPTION_MODEL`    | Voice transcription model (default `whisper-1`)                      |
| `OPENAI_TRANSCRIPTION_LANGUAGE` | Language hint for voice transcription, e.g. `ru` (default: auto)      |
| `LOG_LEVEL`                     | Minimum log level, `trace`-`fatal` (default `info`)                   |
| `LOG_FILE`                      | Write logs to this file instead of stdout (unset by default)          |
| `LOG_PRETTY`                    | `true` for human-readable output in local development                 |

### Logging

The bot logs structured JSON lines via [pino](https://getpino.io) to stdout by default, so output is captured by whatever supervises the process. On a server that means:

- **systemd** → `journalctl -u spend-tracer`
- **Docker** → `docker logs <container>`
- **PM2** → `~/.pm2/logs/spend-tracer-out.log` and `spend-tracer-error.log`

Set `LOG_FILE` only if you want a plain log file on disk (for example `/var/log/spend-tracer.log`); the parent directory is created automatically. The process exits non-zero on uncaught exceptions and unhandled rejections (both logged at `fatal` level) so a supervisor can restart it.

For readable output during development use `LOG_PRETTY=true npm run dev`.

### SQLite storage

Data lives in a local SQLite database (built-in `node:sqlite`, no server or extra dependency). The file is created on first run at `DB_PATH` (`data/spend-tracer.db` by default, relative to the process working directory) and is git-ignored. In Docker the bot mounts the repo-root `data/` directory, so production data lives there; running locally from `bot/` writes to `bot/data/` instead.

- `messages` — raw message log: `time | sender | user_id | text`
- `expenses` — structured rows: `time | sender | amount | currency | category | description | paid_at | payer | source | confidence | status`. `status` is `pending` until confirmed, then `confirmed` or `rejected`.

Browse it with any SQLite client, e.g.:

```sh
sqlite3 data/spend-tracer.db 'SELECT expense_date, amount_minor, currency, category, status FROM expenses ORDER BY id DESC LIMIT 10'
```

## Web UI

A Fastify API (`api/`) and a React frontend (`web/`) add browser sign-in on top of the bot. The frontend is a Vite app built into static files, served by nginx, which also proxies `/api/*` to the API container. Sign-in uses Google, gated by an email allowlist. The bot and the API share one database, `data/spend-tracer.db`.

Environment variables, in `.env.example`:

- `GOOGLE_CLIENT_ID` — Google OAuth client id for the sign-in button
- `GOOGLE_ALLOWED_EMAILS` — comma-separated list of allowed emails
- `SESSION_SECRET` — cookie signing key
- `API_PORT` — internal API port (default 3000)
- `DB_PATH` — shared database path (default `data/spend-tracer.db`)
- `TELEGRAM_BOT_USERNAME` — bot username used to build the Telegram link
- `WEB_URL` — public web UI URL shown to unlinked senders

The design is documented in `openspec/`.

## Project structure

```
bot/
  src/
    index.ts         # Entry point; wires up the bot and handles graceful shutdown
    bot.ts           # Message pipeline: text / photo / voice -> expense analysis
    config.ts        # Loads and validates configuration from environment variables
    logger.ts        # pino logger: level, file destination, pretty printing
    db.ts            # Opens the SQLite database, defines the schema and the store
    expenseSchema.ts # ExpenseRecord type, strict JSON schema and LLM prompts
    openai.ts        # OpenAI client: structured text extraction and vision
    transcribe.ts    # Voice transcription via Whisper
    confirm.ts       # Inline confirmation buttons and pending expense flow
    attachments.ts   # Downloads Telegram attachments and describes them
  test/              # Integration tests and committed media fixtures
api/                 # Fastify API: Google sign-in and protected dashboard
  src/               # config, db (users/identities), auth, routes
  test/              # identity resolution tests
web/                 # Vite + React frontend (Login, Dashboard, auth context)
openspec/            # Change proposals and specs
```

## Testing

Integration tests call the real OpenAI API and spend tokens:

```sh
npm test
```

Integration tests call the real OpenAI API. All media fixtures are committed, so the suite runs the same on a fresh checkout. The silence test generates its own clip and spends no tokens.

Committed synthetic voice clips (OpenAI TTS, RU/UK/EN/ES) in `test/fixtures/voices/` are covered by always-on transcription tests. Regenerate them with `npm run generate:voices`. Committed fictional receipt images in `test/fixtures/receipts/` (Spanish pharmacies, EUR) back the always-on vision tests; regenerate with `npm run generate:receipts`.

## License

ISC

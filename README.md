# Spend Tracer

A Telegram bot that turns chat messages, receipt photos and voice messages into structured expense records in a Google Sheets spreadsheet, using OpenAI.

## Features

- Extracts expenses from plain text ("Платил 540 рублей за продукты") via LLM structured output
- Reads totals from receipt/purchase photos (vision)
- Transcribes voice messages (Whisper) and extracts the expense from the transcript
- Detects silent voice messages and notifies the chat instead of transcribing
- Hybrid confirmation: high-confidence expenses are written automatically, uncertain ones get a "Записать / Изменить / Отмена" inline prompt
- Records every message in a raw log sheet, expenses in a dedicated `Expenses` sheet
- Graceful shutdown on `SIGINT` / `SIGTERM`

## Requirements

- Node.js 22.18+ (runs TypeScript natively via type stripping)
- [ffmpeg](https://ffmpeg.org) on PATH (audio preprocessing and silence detection; the bot still works without it, just skips the silence check)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Google Cloud service account with access to a spreadsheet
- An [OpenAI](https://platform.openai.com) API key

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file (see [`.env.example`](.env.example)):

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
| `GOOGLE_SERVICE_ACCOUNT_FILE`   | Path to the service account JSON key                                 |
| `SPREADSHEET_ID`                | ID of the Google Sheet (from its URL)                                |
| `OPENAI_API_KEY`                | OpenAI API key                                                       |
| `OPENAI_MODEL_TEXT`             | Text/voice extraction model (default `gpt-4o-mini`)                  |
| `OPENAI_MODEL_VISION`           | Receipt-photo vision model (default `gpt-4o-mini`)                   |
| `OPENAI_TRANSCRIPTION_MODEL`    | Voice transcription model (default `whisper-1`)                      |

### Google Sheets setup

1. In [Google Cloud Console](https://console.cloud.google.com), create a service account and download its JSON key.
2. Enable the **Google Sheets API** for the project.
3. Share the target spreadsheet with the service account email (`client_email` from the key file) as **Editor**.
4. Point `GOOGLE_SERVICE_ACCOUNT_FILE` at the downloaded key file.

The first sheet holds the raw message log (`time | sender | text`). The `Expenses` sheet is created automatically and holds structured rows: `time | sender | amount | currency | category | description | paid_at | payer | source | confidence | status`. `status` is `pending` until confirmed, then `confirmed` or `rejected`.

## Project structure

```
src/
  index.ts         # Entry point; wires up the bot and handles graceful shutdown
  bot.ts           # Message pipeline: text / photo / voice -> expense analysis
  config.ts        # Loads and validates configuration from environment variables
  expenseSchema.ts # ExpenseRecord type, strict JSON schema and LLM prompts
  openai.ts        # OpenAI client: structured text extraction and vision
  transcribe.ts    # Voice transcription via Whisper
  confirm.ts       # Inline confirmation buttons and pending expense flow
  attachments.ts   # Downloads Telegram attachments and describes them
  sheets.ts        # Authenticates with Google Sheets, writes log and expenses
```

## Testing

Integration tests call the real OpenAI API and spend tokens:

```sh
npm test
```

Text, vision and transcription tests run against real media from `downloads/` (falling back to `test/fixtures/` for pinned copies) and assert on the extracted values. Tests skip the individual fixtures they cannot find, so a fresh checkout without media still runs the rest. The silence test generates its own clip and spends no tokens.

Committed synthetic voice clips (OpenAI TTS, RU/UK/EN/ES) in `test/fixtures/tts/` are covered by always-on transcription tests. Regenerate them with `npm run generate:tts`.

Note: `test/fixtures/photos/` and `test/fixtures/voice/` are gitignored on purpose. Receipt photos and real voice notes are personal data.

## License

ISC

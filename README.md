# Spend Tracer

A Telegram bot that tracks expenses by logging messages, photos of receipts, and voice messages from a chat into a Google Sheets spreadsheet.

## Features

- Logs every text message to a Google Sheet with timestamp and sender info
- Downloads attachments (photos, documents, videos, voice messages, stickers) and records their file paths
- Adds the original caption to attachment entries
- Graceful shutdown on `SIGINT` / `SIGTERM`

## Requirements

- Node.js 18+ (for native `fetch` and top-level await)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Google Cloud service account with access to a spreadsheet

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

## Configuration

| Variable                    | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`        | Token obtained from @BotFather                                        |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Path to the service account JSON key                                  |
| `SPREADSHEET_ID`            | ID of the Google Sheet (from its URL) to append messages to           |

### Google Sheets setup

1. In [Google Cloud Console](https://console.cloud.google.com), create a service account and download its JSON key.
2. Enable the **Google Sheets API** for the project.
3. Share the target spreadsheet with the service account email (`client_email` from the key file) as **Editor**.
4. Point `GOOGLE_SERVICE_ACCOUNT_FILE` at the downloaded key file.

Messages are appended to the first sheet (`sheetsByIndex[0]`), one row per message: `time | sender | text`.

## Project structure

```
src/
  index.js       # Entry point; wires up the bot and handles graceful shutdown
  bot.js         # Telegram bot: listens for messages and forwards them to the sheet
  config.js      # Loads and validates configuration from environment variables
  attachments.js # Downloads and describes non-text message attachments
  sheets.js      # Authenticates with Google Sheets and appends rows
```

## License

ISC

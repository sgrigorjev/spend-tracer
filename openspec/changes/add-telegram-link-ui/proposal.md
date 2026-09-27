## Why

The bot records expenses only from senders whose Telegram account is linked to a registered user, but the web UI offers no way to link one. A fresh account, or any account after a database reset, has no path from the signed-in session to a linked Telegram. The API that issues a one-time link token already exists and nothing calls it, so the user has to build a `t.me` deep link by hand.

## What Changes

- Add a Telegram panel to the account settings page showing whether the account is linked.
- When unlinked, request a one-time token and show the deep link as both a tappable "Open Telegram" button and a QR code, along with the expiry time.
- Poll the link status while the panel is open and switch to the linked state on its own once the bot redeems the token.
- Offer a "create a new link" action when the token expires.
- Add a small QR rendering dependency to `web/`.
- No API, schema or bot changes: the panel reuses `POST /api/telegram/link` and `GET /api/telegram/link/status`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-ui`: the account settings page gains a Telegram linking panel covering the unlinked and linked states, the one-time deep link, QR rendering, expiry and status polling.

## Impact

- `web/src/Settings.tsx` plus a new linking component; `web/package.json` gains a QR dependency.
- Consumes the existing `/api/telegram/link` and `/api/telegram/link/status` endpoints; the API, bot and database are untouched.
- Depends on `TELEGRAM_BOT_USERNAME` being set, since that is what makes the deep link URL non-null. The panel handles its absence with an explanatory message.

## Why

The bot records expenses only from senders whose Telegram account is linked to a registered user, but the web UI offers no way to link one. A fresh account, or any account after a database reset, has no path from the signed-in session to a linked Telegram. The API that issues a one-time link token already exists and nothing calls it, so the user has to build a `t.me` deep link by hand.

## What Changes

- Add a Telegram panel to the account settings page showing whether the account is linked.
- When unlinked, request a one-time token and show the deep link as both a tappable "Open Telegram" button and a QR code, along with the expiry time.
- Poll the link status while the panel is open and switch to the linked state on its own once the bot redeems the token.
- Offer a "create a new link" action when the token expires.
- Add a small QR rendering dependency to `web/`.
- Keep `link_tokens` bounded: issuing a token removes expired and already-used rows and supersedes the user's earlier pending token, so at most one live token exists per user.
- No API route, bot or schema changes: the panel reuses `POST /api/telegram/link` and `GET /api/telegram/link/status`, and the only backend change is token cleanup in the shared store.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-ui`: the account settings page gains a Telegram linking panel covering the unlinked and linked states, the one-time deep link, QR rendering, expiry and status polling.
- `data-model`: the Telegram account linking requirement gains the token lifecycle rules: one live token per user, and stale tokens removed when a new one is issued.

## Impact

- `web/src/Settings.tsx` plus a new linking component; `web/package.json` gains a QR dependency.
- `shared/src/db.ts` (`createLinkToken`) now purges stale tokens and the user's earlier pending token; `api/test/link.test.ts` covers both.
- Consumes the existing `/api/telegram/link` and `/api/telegram/link/status` endpoints; the API routes, bot and schema are untouched.
- Depends on `TELEGRAM_BOT_USERNAME` being set, since that is what makes the deep link URL non-null. The panel handles its absence with an explanatory message.

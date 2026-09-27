## Context

See `proposal.md` for the motivation. The pieces already exist:

- `POST /api/telegram/link` (`api/src/routes/telegram.ts`) mints a 128-bit single-use token with a 600 second TTL and returns `{ token, url, expiresAt }`, where `url` is `https://t.me/<bot>?start=<token>` when `TELEGRAM_BOT_USERNAME` is set, otherwise `null`.
- `GET /api/telegram/link/status` returns `{ linked, telegramUserId }`.
- `store.createLinkToken` / `store.redeemLinkToken` (`shared/src/db.ts`) enforce single use and a one-to-one Telegram-to-user mapping.
- The bot binds the account on `/start <token>` (`bot/src/bot.ts`).
- `getSessionUser` (`api/src/guard.ts`) reloads the user from SQLite on every request, so polling the status endpoint observes a link made elsewhere.

The account settings page (`web/src/Settings.tsx`) only holds display currency and timezone and never calls the link endpoints.

## Goals / Non-Goals

Goals:

- Let a signed-in user link a Telegram account from settings without leaving the page or touching the database.
- Cover both orientations: the site open on a desktop while Telegram is on a phone (QR), and the site open on the phone itself (tappable deep link).
- Reflect a completed link in the already-open page.

Non-Goals:

- Unlinking or re-linking an account. The one-to-one mapping stays unbreakable from the UI in this change.
- Any change to the API, bot or schema. The endpoints and store methods are consumed as they are.
- Linking from the bot side (for example a `/start` code typed into the site).

## Decisions

### Reuse the existing link endpoints

The panel calls `POST /api/telegram/link` on demand and `GET /api/telegram/link/status` for state. No new route, no schema change. The backend already carries the security properties that matter (single use, short TTL, authenticated, one-to-one), so duplicating any of it in the web layer would add surface without value.

Alternative considered: a server-rendered QR image endpoint. Rejected because the QR is a presentation concern and the API already returns the URL to encode.

### Show both the deep link and the QR code

One artifact cannot serve both device setups. A button that opens `t.me/...` works when the page is on the phone; a QR code works when the page is on the desktop and the phone is free. Rendering both costs one component and removes a support case.

### Render the QR in the browser with a small dependency

Add `qrcode.react` to `web/` and render an SVG. It avoids a server round-trip per QR, keeps the token out of any server-rendered HTML, and fits the existing React 19 and Vite setup.

Alternatives considered: generating the QR in the API (pulls a server library and mixes presentation into the API); hand-rolling a QR encoder (more code to review than the dependency). `qrcode.react` is small, maintained, SVG-based, and covered by Dependabot.

### Poll while the panel is open, then stop

While a pending link is shown, poll `GET /api/telegram/link/status` every 3 seconds. Stop when the link completes, the panel closes, the component unmounts, or the token expires. 3 seconds keeps the desktop flip feeling immediate while adding at most 20 requests over a 600 second token lifetime for one user.

Alternative considered: no polling, refresh manually. Rejected because the page is usually on a different device from the one that completes the link, so the user has no reason to refresh.

### Keep the token in memory only

The token lives in React state for the lifetime of the open panel. It is never written to `localStorage` or `sessionStorage`, never copied to the clipboard automatically, and never logged. Closing the panel, completing the link, or reloading the page drops it. A fresh visit always mints a new token.

### Trust the server's expiry, allow regeneration

The client computes the remaining time from the server's `expiresAt` and shows it. When it reaches zero, or the status endpoint reports a failure, the panel shows an expired state with a "create a new link" action that calls the link endpoint again. The client does not extend or reuse an expired token.

### Treat a null URL as a configuration state

When `TELEGRAM_BOT_USERNAME` is unset the endpoint returns `url: null`. The panel then explains that linking is not configured rather than showing a broken link or an empty QR. This surfaces a deployment mistake instead of hiding it.

## Security analysis

The link token is a bearer credential for binding a Telegram account, so it gets the same care as a password reset code.

- Issuance requires a session (`requireUser`), so only the signed-in user can mint one, and the token is bound to that user's row.
- The token is 128-bit random, single use, and expires in 600 seconds. The store consumes the token and writes the binding in one transaction, so a crash cannot leave a reusable token.
- The one-to-one mapping means a token leaked to a third party binds that party's Telegram only if no other account is linked; if the user's own account is already linked the redeem fails with `telegram_taken`.
- QR and deep link expose the token to the phone's Telegram client and, transitively, to Telegram's servers as a start payload. That is inherent to Telegram deep links. The short TTL and single use bound the damage; the token grants only the one-time bind.
- The token stays in memory only, is not logged on either side, and the status endpoint exposes nothing beyond the user's own link state.
- Minting tokens grows the `link_tokens` table with rows that are never read after expiry. This change does not add cleanup. Impact is negligible at this scale; a purge is a possible follow-up.

## Risks / Trade-offs

- [Polling keeps hitting the API if a stop condition is missed] → tie the interval to the panel being open and the token being unexpired, and clear it in the effect cleanup.
- [Browser and server clocks disagree, so the countdown and the server's expiry drift] → the server remains the authority; the panel regenerates on any redeem failure rather than trusting its own timer alone.
- [A new web dependency widens the supply chain] → the library is small and SVG-only; pin the version and let Dependabot track updates.
- [No unlink path means a wrongly linked account needs a database fix] → accepted and declared a non-goal; a follow-up change can add unlink with its own security review.

## Migration Plan

Web-only change; the API, bot and database stay as they are, so there is no data migration and no coordination with the running bot. Deploy the web build and configure `TELEGRAM_BOT_USERNAME` if it is not already set. Roll back by reverting the web build; no state is written by the UI, so rollback is clean.

## Open Questions

None that affect the specs or the approach.

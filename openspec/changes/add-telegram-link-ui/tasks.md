## 1. Dependency and component scaffold

- [x] 1.1 Add `qrcode.react` to `web/package.json` and install; verify `npm install` succeeds in `web/` and `npm run typecheck` passes.
- [x] 1.2 Create a `TelegramSettings` component and render it as a card on the settings page next to the display card; verify the page renders in the browser with the card visible.

## 2. Link state

- [x] 2.1 Load `GET /api/telegram/link/status` on mount and render the linked and unlinked states from it; verify typecheck passes and each state renders correctly given the mocked response.
- [x] 2.2 Render an error state when the status request fails, without showing a stale link state; verify the failure path renders the error (network blocked or mocked 500).

## 3. Issuing and presenting the link

- [x] 3.1 On request, call `POST /api/telegram/link` and hold `token`, `url` and `expiresAt` in component state only; verify by code review that no storage or logging API receives the token.
- [x] 3.2 Render the deep link as a tappable Telegram link and the same URL as a QR code, with the expiry shown; verify the QR decodes to the returned URL and the link renders (screenshot plus a decode check).
- [x] 3.3 When the endpoint returns `url: null`, show the not-configured message and render no QR or link; verify against a mocked null response.

## 4. Polling and expiry

- [x] 4.1 Poll `GET /api/telegram/link/status` every 3 seconds while a link is pending and switch to the linked state on success; verify in the network tab that polling starts with the panel and stops on link, panel close and unmount.
- [x] 4.2 Show an expired state when the countdown reaches zero and offer a "create a new link" action that mints a fresh token; verify a new token is issued after expiry and the old one is no longer displayed.

## 5. Security, quality and release

- [ ] 5.1 Review the diff for token exposure (no `localStorage`, no `sessionStorage`, no `console` output, no token in the URL bar) and confirm the panel only ever shows the deep link and QR; record the outcome in `review.md`.
- [x] 5.2 Run `npm run typecheck` in `web/` and in `bot/`; verify both pass before opening the PR.
- [ ] 5.3 Verify end to end on the stage environment: open settings, scan the QR with the phone, tap Start, confirm the open page flips to the linked state and the bot then records an expense from that account.

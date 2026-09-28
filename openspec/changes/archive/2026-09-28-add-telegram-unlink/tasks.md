## 1. Store

- [x] 1.1 Add `unlinkTelegram(userId: number): void` to the `Store` interface and implement it in `shared/src/db.ts`: clear `telegram_user_id` for the user and delete their live link tokens in one `BEGIN IMMEDIATE` transaction (reuse `deleteUserTokens`); security note, the mapping and the tokens must commit together so a crash cannot leave the account unlinked while a redeemable token stays live. Verify with the store tests below.
- [x] 1.2 Add tests to `api/test/link.test.ts`: unlinking a linked account clears the mapping (`findUserByTelegramId` returns undefined), unlinking discards a pending token (`redeemLinkToken` on it then reads as unknown), and unlinking an unlinked account succeeds without error; verify `node --test test/link.test.ts` in `api/` passes.

## 2. API

- [x] 2.1 Add `DELETE /api/telegram/link` in `api/src/routes/telegram.ts` behind `requireUser`, returning `{ linked: false, telegramUserId: null }` with 200 and calling `store.unlinkTelegram(user.id)`; security note, the route takes no account id and resolves the user from the session only. Verify with the route tests below.
- [x] 2.2 Add `["DELETE", "/api/telegram/link"]` to the unauthenticated list and a signed-in test that unlinks and then reads `GET /api/telegram/link/status` as `linked: false` in `api/test/routes.test.ts`; verify `node --test test/routes.test.ts` in `api/` passes.
- [x] 2.3 Confirm the route appears in the OpenAPI document: `/api/telegram/link` was already listed, so no test change was needed; verify `node --test test/openapi.test.ts` in `api/` passes.

## 3. Web UI

- [x] 3.1 In `web/src/components/TelegramSettings.tsx`, add an Unlink control to the linked state behind an inline confirmation that calls `DELETE /api/telegram/link`, switches to the unlinked state on success, and shows an error while keeping the linked state on failure; verify both the confirmed and cancelled paths render in the browser.
- [x] 3.2 Verify the full flow in the browser against the running stack: link state shows the Unlink action, confirming removes the link and returns the panel to the unlinked state, and the bot then ignores messages from that Telegram account.

## 4. Quality and release

- [x] 4.1 Run `npm run typecheck` in `api/`, `bot/` and `web/`; verify all pass.
- [x] 4.2 Review the diff for authorization scope (session-only user, no account id in the request) and token lifecycle (unlink invalidates pending tokens in one transaction), record the outcome in `review.md`, then open the PR with the `enhancement` label.

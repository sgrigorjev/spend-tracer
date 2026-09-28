## Why

A Telegram account can be linked to a Spend Tracer account but never unlinked. If a user links the wrong account, shares the phone, or stops using Telegram, the bot keeps recording messages for that account until someone edits the database by hand.

## What Changes

- Add `DELETE /api/telegram/link`: remove the signed-in user's Telegram mapping and discard any pending link token, so a deep link opened after the unlink cannot re-link the account.
- Add `store.unlinkTelegram(userId)`: clear `users.telegram_user_id` and the user's live link tokens.
- Add an Unlink action to the Telegram panel in account settings, behind a confirmation step.
- No bot change: the bot already ignores messages from senders with no linked user.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-model`: adds a requirement for unlinking a Telegram account and invalidating its pending link token.
- `web-ui`: adds an unlink action to the Telegram settings panel.

## Impact

- `shared/src/db.ts`: new `unlinkTelegram` method on the store.
- `api/src/routes/telegram.ts`: new `DELETE /api/telegram/link` route.
- `web/src/components/TelegramSettings.tsx`: unlink button and confirmation.
- `api/test/link.test.ts`, `api/test/routes.test.ts`, `api/test/openapi.test.ts`: coverage for the new method and route.
- No schema migration: the mapping lives in the existing nullable `users.telegram_user_id` column.

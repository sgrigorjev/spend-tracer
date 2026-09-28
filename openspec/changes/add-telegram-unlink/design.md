## Context

The Telegram mapping lives in the nullable, unique `users.telegram_user_id` column. Single-use link tokens live in `link_tokens` and are redeemed by the bot through `redeemLinkToken`. The bot and the API share `shared/src/db.ts`, so a new store method is visible to both. Linking already exists; only removal is missing. See proposal.md.

## Goals / Non-Goals

**Goals:**

- Let a signed-in user remove their own Telegram mapping from account settings.
- Make removal atomic, scoped to the session user, and idempotent.
- Leave no live link token behind, so a deep link issued before the unlink cannot re-bind.

**Non-Goals:**

- Deleting expenses, the user account, or any other data.
- A bot-side unlink command.
- Admin or support-driven unlinking.

## Decisions

- **`DELETE /api/telegram/link`, scoped to the session user.** The route uses `requireUser` and takes no user identifier, so a caller can only touch their own account. A `POST /api/telegram/unlink` was the alternative; `DELETE` on the existing link resource pairs with the current `POST` (create) and `GET` (status).
- **Respond 200 with the status shape `{ linked: false, telegramUserId: null }`.** The panel can set the unlinked state straight from the response, and the contract mirrors the status endpoint. A `204` was rejected because the UI would need a second request to confirm.
- **`unlinkTelegram(userId)` clears the mapping and the user's live link tokens.** Dropping tokens is the security-relevant part: the same `deleteUserTokens` statement already used by `createLinkToken` runs in the same `BEGIN IMMEDIATE` transaction as the `telegram_user_id = NULL` update, so a failure cannot leave the account unlinked with a redeemable token still live. Relying on token expiry instead was rejected, since a 10-minute token could re-link seconds after the unlink.
- **Idempotent when nothing is linked.** Clearing an already-null mapping succeeds as a no-op, so a double click or a stale tab is harmless.
- **Inline confirmation in the panel.** Unlinking stops the bot from recording, so the panel asks before sending. There is no dialog component in `web/src/components/ui`, and adding one for a single action is not worth it, so the confirm is a two-step inline control.

## Risks / Trade-offs

- [A stale UI acts on the wrong account] → The route derives the user from the session only; no account id travels in the request, so there is nothing to spoof.
- [Unlink discards a token the user is about to use] → Intended: the stale token must not re-link. The user creates a new link afterwards.
- [Cross-site request could force an unlink] → The session cookie is `SameSite=Lax` and the route is a JSON `fetch`; a cross-site form cannot send `DELETE`. This matches the existing `POST /api/telegram/link` posture with no new exposure.
- [Confirmation friction] → Only shown for a linked account, and re-linking is one step away.

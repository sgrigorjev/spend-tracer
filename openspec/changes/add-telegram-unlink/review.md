# Review: add-telegram-unlink

Independent review by the `reviewer` subagent over `git diff main...HEAD` at commit `9156be4`, against the change's specs and design. The reviewer reports findings only and never edits.

## Findings and dispositions

1. **Minor, the OpenAPI test did not assert the DELETE method** (`api/test/openapi.test.ts:34`). The test lists the `/api/telegram/link` path, but the new DELETE operation shares that path, so the route could be removed and the test would still pass.
   Applied: added an assertion that the DELETE operation is documented.

2. **Nit, the unlink confirm stayed open on failure** (`web/src/components/TelegramSettings.tsx`). A failed request showed the error above the still-open destructive prompt.
   Applied: closed the confirm on both the non-OK and the thrown-error paths, so the panel returns to the linked state with the error alert.

The reviewer also confirmed `unlinkTelegram` is atomic and idempotent (the mapping and tokens commit in one `BEGIN IMMEDIATE`), the route resolves the user from the session only with no account id in the request, all six delta scenarios have implementations, and the bot already ignores unlinked senders.

## Verification

- `node --test test/openapi.test.ts test/link.test.ts test/routes.test.ts` in `api/` passes (20 tests), plus `test/db.test.ts` in `api/` and `bot/`.
- `npm run typecheck` passes in `api/`, `bot/` and `web/`.
- Browser check on the running stack: the linked state shows Unlink Telegram, Cancel sends no request, and confirming sends `DELETE /api/telegram/link` (200) and the panel returns to the unlinked state.

## CodeRabbit follow-up

CodeRabbit flagged one minor finding on PR #75 (`web/src/components/TelegramSettings.tsx`): the status poll cleared only its interval, so a poll started just before a successful unlink could still resolve and restore the linked view.

Applied: added a `cancelled` flag set in the effect cleanup; a poll result is now ignored once its polling run is torn down, so a stale response cannot flip the panel back to linked after an unlink.


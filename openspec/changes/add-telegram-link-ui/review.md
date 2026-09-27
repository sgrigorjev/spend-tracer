# Review: add-telegram-link-ui

Independent review by the `reviewer` subagent over `git diff main...HEAD` at commit `dc9b7b5`, against the change's specs and design. The reviewer reports findings only and never edits.

## Findings and dispositions

1. **Minor, expired state still rendered the QR and the "Scan the code" instruction** (`web/src/components/TelegramSettings.tsx`). The QR and paragraph sat above the expired/active ternary, so an expired panel still invited scanning a dead token.
   Applied: moved the QR and the instruction into the non-expired branch; the expired branch now shows only the message and the "create a new link" action.

2. **Minor, countdown interval kept firing after expiry** (`web/src/components/TelegramSettings.tsx`). The 1-second interval depended only on `pending`, so it kept re-rendering once the link expired.
   Applied: added `expired` to the effect guard and dependency array, clearing the interval the moment the link expires.

3. **Nit, QR quiet zone undersized** (`web/src/components/TelegramSettings.tsx`). `marginSize={1}` is below the 4-module quiet zone the QR spec recommends.
   Applied: `marginSize={4}`.

4. **Nit, `startLinking` not guarded against unmount** (`web/src/components/TelegramSettings.tsx`). An in-flight link request could set state after navigation.
   Applied: added a `mounted` ref, set in an effect body so it survives StrictMode's mount/unmount/mount, and guarded the post-await state updates.

5. **Nit, QR `<title>` without `role="img"`** (`web/src/components/TelegramSettings.tsx`). A bare SVG `<title>` is not reliably announced as a labelled image.
   Applied: dropped the `title` prop and wrapped the QR in a `role="img"` element with `aria-label="QR code for the Telegram link"`.

The reviewer also confirmed token handling is correct: the `token` field is discarded, only `url`/`expiresAt` are held in state, nothing is written to storage, logged, or placed in the URL bar, and the deep-link anchor uses `rel="noreferrer"`. No blockers or security issues.

## Verification after fixes

- `npm run typecheck` passes in `web/` and `bot/`.
- Browser render on the running stack with mocked endpoints: linked, unlinked, pending (QR 176x176, `role="img"` label), expired (no QR, "create a new link"), not configured (`url: null`), and status-error with retry.
- Polling flips the open page from pending to linked after one 3-second tick.

## Second round: token lifecycle backend

Independent review of the token-cleanup change (`createLinkToken` purging stale rows and superseding the user's earlier pending token, plus the new tests and the `data-model` delta).

1. **Minor, `createLinkToken` did not bound its TTL** (`shared/src/db.ts`). Any `ttlSeconds`, including zero or negative, minted an already-expired token that stayed until a later mint purged it.
   Applied in part: added a doc comment on the store interface stating that a positive lifetime is expected and that a non-positive value mints an already-expired token used by tests. Declined the throw or clamp: the only caller passes the `600` constant, and the negative TTL is how the existing expiry test builds an expired row.

2. **Nit, `redeemLinkToken` reads the token before its transaction** (`shared/src/db.ts`). A mint that supersedes the token between the read and `BEGIN IMMEDIATE` makes the redeem report `used` instead of `unknown`.
   Declined: the run-outside-transaction read predates this change and is functionally safe, since nothing is bound; only the failure reason string differs, and both are reported to the user as a failed link.

3. **Nit, the purge test did not isolate the expired case** (`api/test/link.test.ts`). The expired row was already purged by the intermediate mint, so the comment overstated which call did the purging.
   Applied: split into two cases, an expired token and a used token, each purged by its own fresh mint and then asserted to read as `unknown`.

Verification after the fixes: `node --test test/link.test.ts` in `api/` passes (3 tests), and `npm run typecheck` passes in `api/`, `bot/` and `web/`.


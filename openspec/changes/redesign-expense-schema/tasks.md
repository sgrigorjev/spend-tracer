## 1. Shared database foundation

- [x] 1.1 Add a single database path setting read by both services and open one shared SQLite file; verify both services log the same resolved path on startup
- [x] 1.2 Create the v2 schema for `users`, `identities`, `expenses`, `messages`, `link_tokens`, `exchange_rates`, `families` and `family_members`, with the `expense_date` and active-membership indexes, and enable a rollback journal plus a busy timeout; verify tables and indexes exist with `PRAGMA table_info` and `PRAGMA index_list`
- [x] 1.3 Add a store test that creating the schema twice is idempotent; verify `node --test test/db.test.ts` passes

## 2. Money, dates and FX

- [x] 2.1 Add helpers to convert decimal amounts to integer minor units and back, honouring zero-decimal currencies; verify unit tests cover rounding and a zero-decimal currency
- [x] 2.2 Add `expense_date` computation from `paid_at`, falling back to `created_at` in the owner timezone, carrying the precision flag; verify tests for date-only, offset timestamp, and a missing `paid_at` across a day boundary
- [x] 2.3 Add the Frankfurter rate lookup with nearest-prior-date fallback and an `exchange_rates` cache; verify a test with a mocked fetch returns a prior rate for a weekend date
- [x] 2.4 Persist the base amount, rate and rate date at write time; verify a test shows rate 1 for a same-currency expense and a stored rate for a foreign-currency one

## 3. Bot: registration gate and storage

- [x] 3.1 Resolve the sender's `telegram_user_id` to a linked user before any extraction; verify a test that an unlinked sender gets one onboarding reply and no message or expense row is written
- [x] 3.2 Rewrite the bot store for the new `expenses` and `messages` schema with `user_id`; verify the store test inserts and reads back an expense
- [x] 3.3 Update the confirmation and edit flows to the new fields and minor units; verify tests for pending to confirmed and pending to rejected transitions
- [x] 3.4 Normalize the LLM extraction output to minor units, `paid_at` conventions and `expense_date`; verify the extraction test produces a well-formed row

## 4. API: accounts and linking

- [x] 4.1 Merge the API store onto the shared database, keeping only user and identity concerns; verify the existing auth test still resolves and creates a user
- [x] 4.2 Add the `link_tokens` store and the link request plus status endpoints; verify unauthenticated calls return 401 and an authenticated call returns a link with a token
- [x] 4.3 Handle token consumption from a start command in private chat or a group, binding `telegram_user_id`; verify a store test covers success, unknown token, expired token, reused token and an already-linked Telegram account
- [x] 4.4 Enforce that tokens are single-use, short-lived, bound to the creating user and generated with 128-bit randomness; verify a test that a second use of the same token fails

## 5. Profile and configuration

- [x] 5.1 Add `display_currency` and `display_timezone` with defaults to the user profile; verify the sign-in and current-user responses include both values
- [x] 5.2 Update `.env.example` and `docker-compose.yml` to the single database path; verify `docker compose config` renders without the old path
- [x] 5.3 Remove the old API database path and any leftover Google Sheets references from code and config; verify a search for the old variable and file name returns nothing

## 6. Family sharing

- [x] 6.1 Add the family and membership store with create, invite, accept, decline, leave and remove; verify a store test covers each transition and that invited memberships are not visible
- [x] 6.2 Enforce one active family per user in the store and confirm the partial unique index rejects a second active membership; verify a test that a second acceptance fails
- [x] 6.3 Add the family routes: create a family, invite by email, list pending invitations, accept or decline, leave, and remove; verify the owner-only and unknown-email branches with tests
- [x] 6.4 Add the scope resolver that turns me, family or a member id into a set of user ids using active memberships; verify a test that a member outside the viewer's family returns 403 and that family scope includes all active members

## 7. Verification

- [x] 7.1 Run `npm run typecheck` in `bot/` and `api/`; verify both are clean
- [x] 7.2 Run the targeted tests for storage, auth, linking, dates, FX and family scope; verify they pass
- [x] 7.3 Smoke test in a browser and chat: register, link Telegram, send a text, photo and voice expense, and confirm a pending one; verify each row lands under the user with the correct `expense_date`, minor units and base amount
- [x] 7.4 Smoke test from an unlinked Telegram account; verify it receives the onboarding reply and that no message or expense row appears
- [x] 7.5 Smoke test family sharing: two users with no family see only their own expenses, then form a family and verify each can see the other, and that a non-member scope is rejected

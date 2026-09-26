## Why

The current storage cannot serve the dashboard or a multi-user bot. Dates are stored as `DD.MM.YYYY HH:MM:SS` strings that SQLite date functions cannot parse, money is `REAL`, there is no timezone handling, expenses belong to nobody, and the bot writes one database while the API owns another. We are still a prototype, so we can replace the schema instead of migrating around it.

## What Changes

- **BREAKING** Replace the `expenses` and `messages` schema with a v2 model. Existing rows are dropped; collection starts from scratch.
- **BREAKING** Collapse `data/spend-tracer.db` and `data/api.db` into one database file shared by bot and API.
- **BREAKING** The bot only records expenses from users who registered on the site and linked their Telegram account. Messages from unlinked senders are dropped, not stored.
- Every expense carries a `user_id` and belongs to exactly one user. There is no separate payer dimension; a "paid for mom" case goes into the description.
- Store money as integer minor units plus an ISO-4217 currency, with a base-currency equivalent and an FX-rate snapshot taken at write time.
- Store `created_at` as a UTC instant, `paid_at` as a local timestamp with offset plus a precision flag, and a materialized `expense_date` for grouping.
- Add `users`, `identities`, `link_tokens`, `exchange_rates`, `families` and `family_members` tables. Drop the separate `members` concept.
- Add a one-time-token flow that links a Telegram account to a signed-in user.
- Move display currency and display timezone into the user profile.
- Make the dashboard private by default. A user sees only their own expenses until they create or join a family group.
- Add family groups with invitations: an owner invites a registered user, the invitee accepts, and active members can see each other's expenses. A user has at most one active family.
- Add a dashboard scope of me, the whole family, or one member, enforced server-side against the viewer's membership.

## Capabilities

### New Capabilities

- `data-model`: the unified SQLite schema, its ownership and attribution rules, the date, money and timezone conventions, the account/Telegram linking rules that gate what the bot may store, and how family membership is stored.
- `family-sharing`: creating a family group, inviting and accepting members, the one-active-family rule, and the visibility and scope rules that decide whose expenses a viewer may read.

### Modified Capabilities

None. The sign-in and session behavior in `web-ui` is unchanged; reading the new schema from the dashboard endpoints belongs to a separate change.

## Impact

- `bot/src/db.ts`: schema and store rewritten.
- `bot/src/bot.ts`, `bot/src/confirm.ts`: sender resolved to a linked user, unlinked senders rejected, date and money handling updated.
- `api/src/db.ts`: merged into the shared schema; auth store keeps only user and identity concerns, plus a family and membership store.
- `api/src/routes/auth.ts`, `api/src/routes/dashboard.ts`: adapt to the merged database; the dashboard read endpoints are a separate change, while the scope resolver lands with family sharing.
- `api/src/routes/family.ts`: new family group and invitation endpoints.
- `api/src/config.ts`, `.env.example`, `docker-compose.yml`: one database path.
- `bot/src/expenseSchema.ts`: amount and date output normalized to the new conventions.
- `web/mockups/README.md`: note the resolved data questions.

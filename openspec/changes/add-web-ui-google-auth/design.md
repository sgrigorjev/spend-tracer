## Context

The repo runs the Telegram bot from `bot/` with TypeScript executed natively (Node 22+, no build step), `node:sqlite` for storage, and pino for logging. `web/` holds a single static `index.html` served by the `nginx:alpine` image. `docker-compose.yml` has two services: `bot` and `web` (bound to `127.0.0.1:8001`). Config lives in `bot/.env`; the deploy flow copies `bot/.env.example`.

The API and web app should follow the same conventions where they apply: native TypeScript, `node:sqlite`, pino, and fail-fast env loading. The web frontend is the one place a build step is unavoidable, since Vite produces static assets for nginx.

## Goals / Non-Goals

**Goals:**

- A working sign-in loop: GIS button, token verification, allowlist gate, session cookie, and a protected dashboard stub.
- Keep the bot's message pipeline untouched and the deploy flow working with one `docker compose up -d --build`.
- Match the project's existing runtime and logging conventions.

**Non-Goals:**

- Reading the bot's expense data into the dashboard.
- TLS, a real domain, or exposing the web service beyond localhost.
- Multi-provider sign-in (GitHub), though the schema leaves room for it.
- Moving the allowlist into the database.

## Decisions

### Native TypeScript for the API, no build step

The API runs `node src/index.ts` directly, mirroring the bot. Fastify and `google-auth-library` work fine under type stripping. Alternative rejected: a `tsc` build step, which the bot does not use and which would add an unnecessary divergence.

### One shared `.env` file

Both `bot` and `api` read the same root `.env`, moved there from `bot/` so the two services share one file. The bot's env loader now points at the root `.env` explicitly. The five new variables join the existing ones, so the deploy flow's single `cp .env.example .env` keeps working. Alternative considered: a separate `api/.env`. Rejected because it adds a second secret file to the deploy flow with no real isolation benefit for a single-owner app.

### Auth model: verify token, resolve user by identity then email

`google-auth-library` verifies the ID token and yields `email` and `sub`. Resolution order matches the draft: look up an identity by `(provider, subject)`; if missing, find a user by verified email and attach the identity; if still missing, create both. The `identities` table keeps the user `id` stable across future providers.

### Session via `@fastify/secure-session`

A signed httpOnly cookie, `sameSite=lax`, `path=/`, with `secure: false`. The whole stack runs over plain HTTP today, since TLS is out of scope, so a `secure` cookie would never be sent and sign-in would break. Set `secure: true` when TLS is added. The API is same-origin with the SPA through the nginx `/api` proxy, so `lax` blocks cross-site cookie sends without needing a CSRF token for the current endpoints.

### nginx serves the SPA and proxies `/api/*`

`nginx.conf` serves the built `dist/` with `try_files ... /index.html` fallback for client-side routing, and proxies `/api/` to `api:3000`. The `web` service keeps its existing `127.0.0.1:8001:80` binding. The `api` service gets no host port.

### Dashboard stub returns `{ user, totalExpenses: null }`

The endpoint requires a session and returns the user plus a `null` total, so the frontend has a stable shape to render against before expense data is wired in.

## Risks / Trade-offs

- [Cookie `secure` flag over plain HTTP] → keep `secure: false` until TLS is added (out of scope); a `secure` cookie is not sent over HTTP and would break sign-in.
- [Sharing one `.env` across services] → a missing variable fails fast in both `config.ts` files at startup, matching the bot's existing behavior.
- [CSRF via cookie-only auth] → mitigated by `sameSite=lax` plus same-origin proxying; sign-in still requires a Google token, not just the cookie.
- [Static allowlist] → the draft accepts this as out of scope; changing entries requires a config edit and restart.
- [GIS needs manual console setup] → a one-time step in Google Cloud Console (OAuth consent screen plus the authorized JavaScript origin). Not code.

## Migration Plan

1. Add the five variables to `.env.example` and to the server's `.env`.
2. Add the `api` service and rewrite `web` in `docker-compose.yml`, and add `nginx.conf`.
3. `docker compose up -d --build`; confirm the bot still starts and `web` serves the SPA.
4. Sign in with an allowed Google account and confirm the dashboard stub loads.

Rollback is a revert of the compose and env changes and removing the new service. No data migration is involved; `data/api.db` is created on first sign-in.

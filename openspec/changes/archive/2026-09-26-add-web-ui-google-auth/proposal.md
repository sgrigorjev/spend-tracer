## Why

The bot stores expenses in a local SQLite file, but the only way to see them is the chat or a raw database query. The `web/` folder is a static placeholder. This change adds a real web UI with Google sign-in so the owner can log in from a browser and, later, read their expenses in a dashboard.

## What Changes

- Replace the static `web/` placeholder with a React (Vite) single-page app: a Login page, a protected Dashboard stub, and the plumbing between them.
- Add a new `api/` service (Fastify, TypeScript) that verifies Google ID tokens, gates access behind an email allowlist, and issues signed session cookies.
- Add `nginx.conf` so the `web` container serves the built SPA and proxies `/api/*` to the `api` container over the compose network.
- Give the API its own SQLite database (`data/api.db`) for accounts and identities, separate from the bot's `data/spend-tracer.db`.
- Add five endpoints: `POST /api/auth/google`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/config` (returns the public Google client id for the sign-in button), and `GET /api/dashboard` (stub returning `totalExpenses: null`).
- Move `.env` and `.env.example` to the repo root, since both `bot` and `api` now read the same file.
- Add five environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_ALLOWED_EMAILS`, `API_PORT`, `SESSION_SECRET`, `API_DB_PATH`) to `.env.example`.
- Update `docker-compose.yml`: add the `api` service, point both services at the root `.env`, turn `web` into a multi-stage build, and keep `api` off the host network.

The bot's message pipeline is unchanged; only its env loader now reads the root `.env`.

## Capabilities

### New Capabilities

- `web-ui`: browser sign-in with Google, gated by an email allowlist, a signed session, and a protected dashboard placeholder.

### Modified Capabilities

None.

## Impact

- New `api/` service with its own `package.json`, `tsconfig.json`, and `Dockerfile`.
- `web/` becomes a Vite + React app with a multi-stage `Dockerfile`.
- `docker-compose.yml` gains a service and changes how `web` is built and served.
- New `nginx.conf`.
- `.env` and `.env.example` move to the repo root; the bot and api env loaders point at the root `.env`, which gains five variables. The deploy flow's `.env` needs the same additions.
- Deployment: the `web` service stays bound to `127.0.0.1:8001` for now, since no reverse proxy exists yet. Exposing port 80 directly is out of scope.

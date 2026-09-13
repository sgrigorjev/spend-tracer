## 1. API service scaffold

- [x] 1.1 Create `api/` with `package.json`, `tsconfig.json`, and `Dockerfile`; verify `npm run typecheck` passes from `api/`
- [x] 1.2 Add `src/index.ts` (Fastify bootstrap and graceful shutdown) and `src/config.ts` (fail-fast env loading for the five new variables); verify the process starts and reports missing variables

## 2. API database

- [x] 2.1 Add `src/db.ts` with `users` and `identities` tables and an identity-then-email resolution function; verify a targeted node:test asserts resolution order

## 3. Authentication and session

- [x] 3.1 Add `src/auth.ts` for Google ID-token verification with `google-auth-library` and the allowlist check; verify an invalid token returns 401 and a disallowed email returns 403
- [x] 3.2 Add `src/routes/auth.ts` (`POST /api/auth/google`, `POST /api/auth/logout`, `GET /api/auth/me`) with `@fastify/secure-session`; verify `GET /api/auth/me` returns 401 without a cookie and the user with one
- [x] 3.3 Add `src/routes/dashboard.ts` returning `{ user, totalExpenses: null }`; verify it returns 401 unauthenticated and the payload when signed in

## 4. Web frontend

- [x] 4.1 Scaffold `web/` as a Vite + React app with a multi-stage `Dockerfile`; verify `npm run build` produces `dist/`
- [x] 4.2 Add the Login page with a Google Identity Services button posting `{ idToken }` to `/api/auth/google`; verify the button renders and calls the endpoint
- [x] 4.3 Add auth context and router that guards the Dashboard; verify an unauthenticated visit lands on Login and a signed-in visit shows the Dashboard

## 5. Serving and configuration

- [x] 5.1 Add `nginx.conf` with SPA fallback and `/api/` proxy to `api:3000`; verify the built app loads and `/api/auth/me` proxies correctly
- [x] 5.2 Update `docker-compose.yml` (add `api`, rebuild `web` as multi-stage, no host port for `api`) and add the five variables to `.env.example`; verify `docker compose config` is valid

## 6. End-to-end check

- [ ] 6.1 `docker compose up -d --build` and confirm the bot still starts and `web` serves the SPA
- [ ] 6.2 Sign in with an allowed Google account and confirm the Dashboard stub loads; confirm a disallowed account is rejected and logout clears the session

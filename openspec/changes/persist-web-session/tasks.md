## 1. API session lifetime

- [x] 1.1 Add `sessionMaxAge` to `api/src/config.ts`, parsed from `SESSION_MAX_AGE` in seconds with a default of 0. Verify `npm run typecheck` passes from `api/`.
- [x] 1.2 In `api/src/index.ts`, apply `maxAge` to the secure-session cookie only when `sessionMaxAge` is positive, so the default stays a session cookie. Verify the default still produces a session cookie. Security: a persistent cookie widens the stolen-cookie window, so keep the default at 0.
- [x] 1.3 Add `SESSION_MAX_AGE` to `.env.example` with a comment giving the unit and the default. Verify the api starts with the variable present and unset.

## 2. Local Playwright session

- [x] 2.1 Remove `--headless` from the Playwright MCP command in `opencode.json` so the browser runs headed on the developer's display.
- [x] 2.2 Set `SESSION_MAX_AGE=2592000` in the local `.env` and rebuild `api` with `docker compose up -d --build api`, since the source is copied into the image at build time. Verify the sign-in response cookie carries `Max-Age=2592000` and the MCP profile stores the `session` cookie with `is_persistent: 1`. Security: the local `.env` is gitignored, so the value is not committed.

## 3. Documentation

- [x] 3.1 Add an `AGENTS.md` section on the Playwright session workflow: the headed browser, the developer signing in once, the persistent profile and cookie, the agent using the authenticated API, and offering to repeat the sign-in when a call returns 401. Security: note that the MCP profile holds the developer's Google cookies and must stay local.

## 4. Verification

- [x] 4.1 Run `npm run typecheck` from `api/`.
- [x] 4.2 Sign in through the MCP browser and confirm `/api/auth/me` returns 200, and that a request without the cookie returns 401.
- [x] 4.3 Confirm persistence: after signing in, read the MCP profile Cookies database and check the `session` cookie has `is_persistent: 1` and a non-zero `expires_utc`.

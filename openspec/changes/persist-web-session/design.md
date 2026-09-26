## Context

See `proposal.md` for motivation. The relevant current state:

- The API registers `@fastify/secure-session` in `api/src/index.ts` with a cookie of `path: "/"`, `httpOnly: true`, `secure: false`, `sameSite: "lax"`, and no `maxAge`. Without `maxAge` the cookie is a session cookie.
- I confirmed the session cookie is non-persistent: in the Playwright MCP profile's Cookies database the `session` cookie has `is_persistent: 0` and `expires_utc: 0`.
- The Playwright MCP runs with `--browser chromium` and no `--isolated`, so its profile persists at `~/.cache/ms-playwright-mcp/mcp-chrome-for-testing-<hash>`. Google cookies persist there, the API session cookie does not.

## Goals / Non-Goals

**Goals:**

- Make the session lifetime configurable without changing the default.
- Let the local Playwright workflow reuse an authenticated API session across restarts.
- Document the workflow so the agent knows what to do when the session is missing or expired.

**Non-Goals:**

- Changing the default session behavior in production.
- TLS or `secure: true` cookies.
- Changing the auth flow, the web frontend, or the bot.

## Decisions

### SESSION_MAX_AGE in seconds, default 0

Add `sessionMaxAge` to `api/src/config.ts`, parsed from `SESSION_MAX_AGE` with a default of 0. In `api/src/index.ts`, pass `maxAge` to the cookie and `expiry` to the session only when the value is positive. `maxAge` must be conditional because `@fastify/cookie` treats `maxAge: 0` as an immediate expiry and would delete the cookie on every response. `expiry` must match, because `@fastify/secure-session` caps the session itself at its 1-day default independently of the cookie, so a 30-day cookie alone would still be rejected after a day. Alternative considered: always pass both and special-case zero elsewhere. Rejected, the conditional spread is clearer and keeps the default path identical to today.

Security: a persistent session widens the window in which a stolen cookie is valid. The default of 0 keeps production on session cookies. When TLS is added, a persistent `maxAge` should be paired with `secure: true`.

### Keep the Playwright MCP headed

Remove `--headless` from `opencode.json` so the browser opens on the developer's display. The developer signs in with Google in that window. The MCP profile is persistent, so the Google cookies survive MCP restarts. With `SESSION_MAX_AGE` set, the API session cookie also survives, so the agent can call the API as the signed-in user across sessions. The removal is committed, so the workflow works from a fresh checkout; the cost is that the MCP then needs a display, and an environment without one must pass `--headless` locally or use a virtual display.

Security: the MCP profile holds the developer's Google cookies. It lives under `~/.cache/ms-playwright-mcp` and must never be committed or shared.

### Document the workflow in AGENTS.md

A new section describes the loop: the agent opens the login page, the developer signs in, the agent verifies the session through `/api/auth/me`, and the agent uses the API while the session is valid. When a call returns 401, the agent offers to repeat the sign-in rather than failing silently.

## Risks / Trade-offs

- [Persistent session widens the stolen-cookie window] default 0 keeps current behavior; enable it only where wanted, and pair with `secure: true` after TLS.
- [The MCP profile stores Google cookies] keep it local, never commit, never share.
- [The committed config needs a display] headed mode fails where no display exists. Such an environment can pass `--headless` locally or run under a virtual display.
- [The developer must sign in interactively] the agent cannot complete Google sign-in itself, so the workflow depends on the developer being present. Persistent Google cookies make re-auth one click when they are still valid.
- [`maxAge: 0` would delete the cookie] omit `maxAge` when the value is not positive.

## Migration Plan

1. Add `SESSION_MAX_AGE` to `.env.example` and to the local `.env`.
2. Restart the `api` service.
3. Sign in through the MCP browser and confirm the cookie carries `Max-Age` and persists.

Rollback is unsetting `SESSION_MAX_AGE` and restarting the `api`. No data migration.

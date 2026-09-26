## Why

The API session is a session cookie, so it ends when the browser closes. That breaks the local workflow where the developer signs in once through the Playwright MCP browser and the agent then calls the authenticated API across restarts. There is also no way to tune how long a session lives.

## What Changes

- Add a `SESSION_MAX_AGE` environment variable, in seconds. When it is a positive number, the API sets the session cookie with that max age, so the cookie is persistent and survives a browser restart. When it is unset or zero, the cookie stays a session cookie, which is the current behavior.
- Add `SESSION_MAX_AGE` to `.env.example` with a comment, and set it to 30 days in the local `.env`.
- Run the Playwright MCP headed by removing `--headless` from `opencode.json`, so the browser opens on the developer's display.
- Document the local session workflow in `AGENTS.md`: the developer signs in once in the opened browser, the persistent MCP profile keeps the Google cookies, and the agent uses the authenticated API. When the session is missing or expired, the agent offers to repeat the sign-in.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-ui`: the session gains a configurable lifetime, so the cookie can persist across browser restarts.

## Impact

- `api/src/config.ts` and `api/src/index.ts`: read `SESSION_MAX_AGE` and apply it to the session cookie.
- `.env.example`: new documented variable. The local `.env` sets it to 30 days, not committed.
- `opencode.json`: drop `--headless` from the Playwright MCP command.
- `AGENTS.md`: new section describing the session workflow.
- No web frontend, bot, database, or auth-flow change.

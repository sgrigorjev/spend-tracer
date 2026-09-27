## Context

See `proposal.md` for motivation. What shapes the approach:

- `web/` is React 19 + Vite with `react-router-dom` v6 already a dependency, and a working `AuthProvider` that resolves the session from `GET /api/auth/me`.
- `App.tsx` already routes `/` to the dashboard and redirects unauthenticated visitors to `/login`; there is no `/dashboard` route. This change pins that behavior and builds the shell around it.
- The mockups define the header (brand, theme toggle, user menu) and the Tailwind v4 + shadcn tokens, and `web-design-system` already governs the visual language.
- `GET /api/settings` and `PATCH /api/settings` already exist and validate the currency and timezone server-side.

## Goals / Non-Goals

**Goals:**

- One authenticated shell that every protected screen renders inside.
- The dashboard at `/` and account settings at `/settings`, both session-gated.
- A settings form that reads and writes the display currency and timezone through the existing API.

**Non-Goals:**

- The dashboard content (charts, table, period controls); that is the next change.
- Any change to the authentication flow, the session, or the settings API.
- Deep-linking back to the requested page after login; unauthenticated visitors always land on the dashboard after signing in.

## Decisions

### A protected layout route with react-router

Add a layout element that renders the shell and an `<Outlet />`, and wrap `/` and `/settings` in it. The layout redirects to `/login` when there is no user, and `/login` redirects to `/` when there is one. Rationale: one place decides authentication and one place renders the chrome, so a new screen cannot accidentally render without the shell. Alternatives: repeating the guard per route (drifts), or a higher-order component (more indirection for the same result).

### Keep the loading gate before routing

`AuthProvider` resolves `/api/auth/me` asynchronously, so the layout must not redirect until that settles, otherwise a signed-in reload of `/settings` would flash to `/login`. The existing `loading` gate stays in front of the routes. Alternative: redirect optimistically and correct later, rejected as a visible flicker and a possible loop.

### The shell owns identity, the page owns its body

The header reads the user from `useAuth` and renders the name plus the avatar, falling back to initials when there is no image. `Dashboard.tsx` shrinks to a placeholder body and drops its `/api/dashboard` fetch; the endpoint is left in place for now. The settings link and log out live in the user menu, matching the mockup.

### Settings page reads and writes the existing API

The page loads `GET /api/settings`, renders a currency select and a timezone select, and saves with `PATCH /api/settings`. On success it refreshes the auth context user so other screens see the new values without a reload. The options come from `Intl.supportedValuesOf("currency")` and `Intl.supportedValuesOf("timeZone")`, always including the user's current value and `UTC`, because `supportedValuesOf` omits valid zones and aliases such as `Europe/Kyiv` and `UTC`. A 400 from the API shows an inline error and leaves the stored settings untouched.

### Reuse the design system

The shell and settings page use the shadcn `Card`, `Button` and `Alert` already in `web/src/components/ui` and the tokens from `web-design-system`, so they match the login page and the mockups. No new dependency.

## Security

- **Server-side authorization stays authoritative.** The route gate is a UX redirect; every protected API call still enforces the session and returns 401/403. The UI never decides access on its own.
- **Settings are validated server-side again.** The selects narrow the choice, but the API re-validates the currency and timezone (`isValidTimeZone` rejects bare offsets), so a crafted request cannot store an invalid value.
- **No new exposure.** The header shows only the signed-in user's own name, avatar and email; the settings page shows only that user's own settings.
- **No redirect loop.** The loading gate resolves before the redirect decision, so an unauthenticated `/settings` visit settles on `/login` once.

## Risks / Trade-offs

- **Redirect flicker or loop on a slow `/api/auth/me`.** → The loading gate stays ahead of routing; verify by reloading `/settings` while signed out.
- **`Intl.supportedValuesOf("timeZone")` omits valid zones.** → Always include the current value and `UTC` in the options, and let the API remain the judge.
- **Stale user after saving.** → Refresh the auth context user on success.
- **The `/api/dashboard` endpoint becomes unused.** → Left in place; removing it is a separate decision (see Open Questions).

## Open Questions

- Whether to remove the now-unused `/api/dashboard` endpoint.
- Whether saving settings should take effect on already-rendered screens immediately, or only on the next load (depends on the next dashboard change).

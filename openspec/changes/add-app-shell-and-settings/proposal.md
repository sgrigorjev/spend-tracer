## Why

The app has no shared authenticated layout and no way to set the display currency or timezone from the UI, so every future screen would rebuild the header and the settings stay unreachable. The root route already serves the dashboard; this change formalizes that and adds the shell and the settings screen the dashboard will sit in.

## What Changes

- Serve the dashboard at the root path `/` and account settings at `/settings`; both require a session and have no other page addresses.
- Redirect an unauthenticated visitor to `/login` by address, never rendering the login form in place.
- Add one authenticated app shell: a header with the brand, a theme toggle, and the signed-in user's name and avatar, with a user menu linking to account settings and offering log out.
- Add an account settings page that edits the display currency and timezone through the existing settings API.
- Leave the dashboard body as the shell only; the dashboard content is a later change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-ui`: the redirect-to-login behavior becomes an address change, and the capability gains the authenticated app shell, the root and settings routes, and the account settings page.

## Impact

- `web/src/App.tsx` and a new layout/shell component; `web/src/Dashboard.tsx` trimmed to a placeholder; a new `web/src/Settings.tsx`.
- Reuses `GET /api/settings`, `PATCH /api/settings` and the auth context. No API change.

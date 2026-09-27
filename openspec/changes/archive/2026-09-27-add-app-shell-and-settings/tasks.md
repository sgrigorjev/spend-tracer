## 1. Routing

- [x] 1.1 Rework `web/src/App.tsx` around a protected layout route: `/` renders the dashboard, `/settings` renders the settings page, both inside the layout, and `/login` renders the login page. The layout redirects to `/login` without a session and `/login` redirects to `/` with one. Verify with `npm run typecheck` from `web/`, and in the browser by opening `/` and `/settings` signed out and confirming the address becomes `/login`. Security: the gate is UX only; the API still enforces the session.

## 2. App shell

- [x] 2.1 Add the shell component: a header with the brand, the theme toggle, and the user menu showing the name and avatar (initials when no image), plus a Settings link and Log out, wrapping the routed page via `<Outlet />`. Verify in the browser that the header shows the user, the Settings link opens `/settings`, and Log out returns to `/login`. Security: the header renders only the signed-in user's own identity.

## 3. Dashboard placeholder

- [x] 3.1 Trim `web/src/Dashboard.tsx` to a placeholder body inside the shell and drop its `/api/dashboard` fetch. Verify in the browser that `/` shows the shell with an empty body and no failed request.

## 4. Account settings page

- [x] 4.1 Add `web/src/Settings.tsx`: load `GET /api/settings`, render a currency select and a timezone select from the `Intl`-supported lists plus the current value and `UTC`, save with `PATCH /api/settings`, show a success or error state, and refresh the auth user on success. Verify in the browser that a change persists across a reload, and that a rejected value (force a 400, for example a temporary invalid value) shows an error and leaves the stored settings unchanged. Security: the API re-validates; the page only narrows the choice.

## 5. Verification

- [x] 5.1 Run `npm run typecheck` in `web/` and a browser pass: sign in, land on `/`, open the user menu, go to `/settings`, change the currency and timezone, save, reload, and log out.

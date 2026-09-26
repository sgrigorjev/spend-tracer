## Context

See `proposal.md` for motivation. The relevant current state:

- `web/` is a Vite + React 19 app with `Login.tsx`, `Dashboard.tsx`, `auth.tsx`, and no styling beyond browser defaults. `web/index.html` loads the Google Identity Services script.
- `web/mockups/login.html` and `dashboard.html` define the target look as static Tailwind v4 files with the shadcn `neutral` token set, Inter, and a `.dark` class toggle.
- The API verifies a Google ID token and returns `403` with `{ error: "email not allowed" }` for a non-allowlisted email, and `401` for a bad token (`api/src/routes/auth.ts`).
- The project runs one PR per change, English artifacts, and `npm run typecheck` before a PR.

## Goals / Non-Goals

**Goals:**

- Put the mockup token set and the primitives Login needs into `web/` so later screens reuse them.
- Match `web/mockups/login.html` for the card, typography, spacing, and states.
- Keep the sign-in contract unchanged: the API still verifies a Google ID token.

**Non-Goals:**

- Restyling the Dashboard. It keeps its current markup in this change.
- Replacing the Google Identity Services button with a custom button.
- Adding a Content Security Policy, SRI, or self-hosted fonts.
- Any API, database, or auth-flow change.

## Decisions

### Tailwind v4 through `@tailwindcss/vite`, tokens copied from the mockups

Copy the `:root` and `.dark` variables and the `@theme inline` mapping from `login.html` into `web/src/index.css`, and register the Vite plugin. Mockup class names then work unchanged, so the login card moves over without renames. Alternative: hand-rolled CSS. Rejected, because the mockups and the future dashboard already assume Tailwind utilities.

Security: each new package is supply-chain surface. Pin versions and read the lockfile diff for install scripts.

### shadcn primitives as source, only what Login uses

Copy `card`, `button`, and `alert` into `web/src/components/ui`, and add the `cn` helper in `web/src/lib/utils.ts`. shadcn copies source rather than adding a runtime library, so the components stay editable and there is nothing to keep in sync at upgrade time. Add nothing the screen does not use; no table, tabs, or dropdown yet.

### Keep the official Google Identity Services button

The mockup draws a custom button, but the app calls `google.accounts.id.renderButton`, which renders Google's own iframe and cannot be restyled. Swapping it for a custom button means moving to the OAuth token or code client, which changes the auth contract and adds risk for no functional gain. Style the card, title, note, and states around the button, and set `renderButton` options (`theme`, `size`, `width`) so it fits the card. Trade-off: the button keeps Google's branding and will not match the mockup pixel for pixel.

### Theme through a `.dark` class and a pre-paint inline script

Store the choice under one `localStorage` key, apply `.dark` to the root element, and run a small inline script in `index.html` before the app bundle sets the class, so a reload does not flash the wrong theme. Security: the script reads a fixed set of strings and ignores anything else, and the value never reaches a DOM sink. It needs no nonce because the app sets no CSP today; adding one is out of scope and would have to allow this script.

### Inter from Google Fonts, as the mockups do

Keep the same CDN link as the mockups. Alternative: self-host Inter, which removes an external request and its privacy cost, but adds font files and licensing bookkeeping. Deferred.

### Map error status codes, not server text

`Login.tsx` shows the allowlist message on `403` and a generic message otherwise. It never renders the API's error string, so a server change cannot leak detail into the UI.

## Risks / Trade-offs

- [The GIS button is a cross-origin iframe] it cannot be styled, so the card around it matches the mockup but the button does not. Accepted, per the decision above.
- [`@tailwindcss/vite` may not support the pinned Vite version] verify the build; fall back to `@tailwindcss/postcss` if it fails.
- [Theme flash on load] mitigated by the pre-paint script; a future CSP must allow it or use a nonce.
- [External CDNs for Inter and Google Identity Services] both are third-party requests with no SRI. Google Identity Services is already loaded today; Inter is new.
- [Dependency surface grows] add only the packages the screen needs and keep them pinned.
- [Styling is not behavior] the `web-ui` auth requirements do not change. This capability covers presentation only.

## Migration Plan

1. Add the dependencies and the Tailwind plugin, then the tokens and Inter.
2. Add the shadcn primitives and the theme provider.
3. Restyle Login and wire the loading and error states.
4. `npm run typecheck` and `npm run build` from `web/`.
5. Screenshot the login page with the Playwright MCP and compare with the mockup, then sign in manually.

Rollback is a revert of the `web/` changes. No data migration.

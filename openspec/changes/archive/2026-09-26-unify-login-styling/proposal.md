## Why

The app's Login page is placeholder markup: a heading, a bare Google button, and an unstyled error paragraph. `web/mockups/login.html` already fixes the intended look (Tailwind v4, shadcn neutral tokens, Inter, light and dark themes). Until `web/` shares those tokens, every screen will drift from the mockups. This change lands the design system and applies it to Login first.

## What Changes

- Add Tailwind CSS v4 to `web/` through `@tailwindcss/vite`, with the neutral token set and the `@theme inline` mapping copied from the mockups.
- Add the shadcn/ui primitives the login screen needs (card, button, alert) as source files in `web/src/components/ui`, plus the `cn` helper.
- Add a theme provider: light and dark, system default, switched by a button and persisted in `localStorage`.
- Load Inter, as the mockups do.
- Restyle `Login.tsx` to the mockup: centered card with brand mark, title, subtitle, Google sign-in control, allowlist note, and footer.
- Add the mockup's loading state (spinner while Google Identity Services loads) and error state, with the "account is not on the allowlist" message for a 403.
- Keep the official Google Identity Services button. It renders in an iframe that Tailwind cannot style, so the card is styled around it. The mockup's custom button stays mockup-only.

No API, database, or auth-flow changes.

## Capabilities

### New Capabilities

- `web-design-system`: shared Tailwind v4 and shadcn design tokens, Inter typography, light and dark theming with persistence, and the Login page presentation built on them.

### Modified Capabilities

None. The existing `web-ui` auth requirements (sign-in, allowlist, session, redirect) do not change; this capability covers presentation only.

## Impact

- `web/package.json` and `web/vite.config.ts`: new dependencies and the Tailwind plugin.
- `web/src/index.css`: new global stylesheet holding the tokens.
- `web/src/components/ui/*` and `web/src/lib/utils.ts`: new shadcn source files.
- `web/src/theme.tsx`: new theme provider and toggle.
- `web/src/Login.tsx`, `web/src/main.tsx`, `web/index.html`: restyled and wired.
- External: Inter from Google Fonts, already used by the mockups.
- No change to `api/`, the bot, or the database.

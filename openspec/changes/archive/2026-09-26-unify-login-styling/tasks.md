## 1. Design tokens and Tailwind

- [x] 1.1 Add `tailwindcss`, `@tailwindcss/vite`, `clsx`, `tailwind-merge`, `class-variance-authority`, and `lucide-react` to `web/package.json` and register the Tailwind plugin in `web/vite.config.ts`. Security: pin versions and read the lockfile diff for install scripts.
- [x] 1.2 Add `web/src/index.css` with the token set and `@theme inline` mapping from `web/mockups/login.html`, and import it in `web/src/main.tsx`. Verify `npm run typecheck` and `npm run build` pass from `web/`.
- [x] 1.3 Add the Inter font link to `web/index.html`, matching the mockup.

## 2. shadcn primitives

- [x] 2.1 Add `web/src/lib/utils.ts` with the `cn` helper.
- [x] 2.2 Add `web/src/components/ui/card.tsx`, `button.tsx`, and `alert.tsx` from shadcn. Add only these three; the login screen needs nothing else.

## 3. Theme

- [x] 3.1 Add `web/src/theme.tsx` with a provider and a toggle: light and dark, system default, persisted in `localStorage`, applied as `.dark` on the root element.
- [x] 3.2 Add the pre-paint theme script to `web/index.html`; verify a reload in each theme does not flash the other one.
- [x] 3.3 Add the top-right theme toggle button to the login page, as in the mockup.

## 4. Login restyle

- [x] 4.1 Restyle `web/src/Login.tsx` to the mockup card: brand mark, title, subtitle, Google sign-in slot, allowlist note, and footer.
- [x] 4.2 Add the loading state while Google Identity Services loads, and the error alert. Map `403` to the allowlist message and every other failure to a generic message; never render server error text.
- [x] 4.3 Keep `accounts.renderButton` and set its options so the button fits the card. Do not switch to a custom button.

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and `npm run build` from `web/`.
- [x] 5.2 Screenshot the login page with the Playwright MCP in light and dark, plus the loading and error states, and compare against `web/mockups/login.html`.
- [x] 5.3 Sign in with an allowed Google account and confirm the dashboard loads; confirm a disallowed account sees the allowlist message; confirm logout clears the session.

## 1. Component

- [x] 1.1 Add `web/src/components/BrandMark.tsx` rendering the orange rounded tile with the white wallet glyph, with a size prop for the header and the login card; verify `npm run typecheck` in `web/` passes.
- [x] 1.2 Use `BrandMark` in `web/src/AppShell.tsx` in place of the `bg-primary` wallet span; verify the header renders the orange mark next to "Spend Tracer".

## 2. Login and themes

- [x] 2.1 Use `BrandMark` on the login card in `web/src/Login.tsx` in place of its `bg-primary` wallet span; verify the login page shows the same mark.
- [x] 2.2 Render the header and login at both themes and confirm the mark keeps the orange tile and white glyph, stays legible, and matches `favicon.svg`; capture a screenshot.
- [x] 2.3 Run `npm run typecheck` in `web/` and open the PR with the `enhancement` label.

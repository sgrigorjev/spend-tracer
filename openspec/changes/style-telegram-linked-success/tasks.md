## 1. Success variant

- [x] 1.1 Add a `success` variant to `web/src/components/ui/alert.tsx` with green border, background and text, plus a dark-theme text variant; verify `npm run typecheck` in `web/` passes.

## 2. Linked state

- [x] 2.1 Switch the linked alert in `web/src/components/TelegramSettings.tsx` to `variant="success"`, keeping the `Check` icon and the text; verify the linked state renders green.
- [x] 2.2 Render the linked state in both themes and confirm the green is legible and clearly a success, distinct from the error state; capture a screenshot.
- [x] 2.3 Run `npm run typecheck` in `web/` and open the PR with the `enhancement` label.

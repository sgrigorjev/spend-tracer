## Why

When a Telegram account is linked, the settings panel shows a neutral muted alert, the same visual weight as informational text. There is no clear signal that linking succeeded. A green success confirmation makes the successful state obvious at a glance.

## What Changes

- Present the linked state as a success confirmation: green styling with the check icon.
- Add a `success` variant to the shared `Alert` component (green, with light and dark variants) and use it for the linked state.
- Keep the existing text and all other states (not linked, expired, error) unchanged.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-ui`: the Telegram link state requirement now presents a linked account as a success-styled confirmation instead of a neutral alert.

## Impact

- `web/src/components/ui/alert.tsx` gains a `success` variant.
- `web/src/components/TelegramSettings.tsx` uses it for the linked state.
- No API, bot or schema changes.

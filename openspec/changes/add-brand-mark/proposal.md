## Why

The header and login card show a wallet in a tile coloured by the neutral `primary` token, so it reads black on light and white on dark. The new favicon is an orange tile with a white wallet, so the in-app mark and the browser-tab mark no longer look like the same brand. Give the app one shared brand mark that matches the favicon and reads well on both themes.

## What Changes

- Add a shared `BrandMark` component: an orange rounded tile with the white Lucide wallet glyph, matching `favicon.svg`.
- Use it in the app header and on the login card, replacing the two copies of the neutral tile.
- Keep the mark identical in the light and dark themes, since the orange tile and white glyph do not depend on the theme.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-design-system`: the app gains a shared brand mark used by the header and the login card, matching the favicon and readable in both themes.

## Impact

- New `web/src/components/BrandMark.tsx`; `web/src/AppShell.tsx` and `web/src/Login.tsx` use it.
- Colour comes from the existing `--chart-1` token, the same one the favicon was built from, so the two stay in sync.

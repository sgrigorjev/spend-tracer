# Review: add-brand-mark

Independent review by the `reviewer` subagent over the branch commit, against the change's specs and design.

## Findings and dispositions

1. **Minor, the design doc named the wrong CSS class** (`openspec/changes/add-brand-mark/design.md:21`). The decision text said the colour was referenced as `bg-[var(--chart-1)]`, while the component uses the generated Tailwind utility `bg-chart-1`.
   Applied: corrected the doc to `bg-chart-1`.

2. **Nit, white on the orange tile is about 3.6:1** (`web/src/components/BrandMark.tsx`). Below the 4.5:1 text threshold but above the 3:1 non-text threshold, and the glyph is `aria-hidden`, so it conveys nothing on its own.
   Declined: the mark is decorative and redundant with the adjacent "Spend Tracer" text, and the orange is the point of matching the favicon.

The reviewer also confirmed `bg-chart-1` is a valid Tailwind v4 utility, `--chart-1` is not overridden in the dark theme so the tile stays orange, `oklch(0.646 0.222 41.116)` is `#f54900`, and the removed `Wallet` imports left no unused bindings.

## Verification

- `npm run typecheck` passes in `web/`.
- Rendered the header mark at 32px and the login mark at 48px in both themes: orange tile, white glyph, matching `favicon.svg`.

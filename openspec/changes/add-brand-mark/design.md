## Context

See `proposal.md`. The header (`web/src/AppShell.tsx`) and the login card (`web/src/Login.tsx`) each render a wallet inside a `rounded-lg`/`rounded-xl` span with `bg-primary text-primary-foreground`. The favicon (`web/public/favicon.svg`) is a `#f54900` rounded tile with a `#fafafa` wallet, where `#f54900` is the `--chart-1` token.

## Goals / Non-Goals

Goals:

- One brand mark shared by the header and the login card, visually matching the favicon.
- Identical appearance in the light and dark themes.

Non-Goals:

- Changing the favicon or its colour.
- Recolouring other `primary`-based controls, such as buttons. Only the brand mark changes.

## Decisions

### Fixed orange tile instead of the theme `primary`

The mark uses a fixed orange tile with a white glyph rather than `bg-primary text-primary-foreground`. A theme-dependent tile flips black to white, which is exactly the mismatch with the favicon this change removes. Orange with white keeps one appearance on both themes and matches the favicon. The colour is referenced as `bg-[var(--chart-1)]` and the glyph as `text-white`, so it tracks the token the favicon was built from.

Alternative considered: keep `bg-primary` and only tint the glyph. Rejected because the tile colour is the most visible part of the favicon, so the mark would still not match.

### One component, two sizes

`BrandMark` takes a size so the header (32px tile, 16px glyph) and the login card (48px tile, 24px glyph) share one definition and cannot drift apart. The Login page currently uses `rounded-xl` and the header `rounded-lg`; the component derives the radius from the size.

## Risks / Trade-offs

- [An orange mark is louder than the previous neutral tile] → the tile is small and appears once; it reads as a deliberate accent in both themes, and this matches the favicon the user asked for.
- [A fixed orange could clash with a future theme] → the colour is a token reference, so changing `--chart-1` updates the mark, the charts and the favicon source together.

## Migration Plan

Web-only, presentational. Deploy the web build; roll back by reverting it. No state or API involved.

## Open Questions

None.

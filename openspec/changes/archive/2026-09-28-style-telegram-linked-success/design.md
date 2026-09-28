## Context

See `proposal.md`. `TelegramSettings` (`web/src/components/TelegramSettings.tsx`) renders the linked state with the default `Alert`, whose variant is a muted grey. The `Alert` component (`web/src/components/ui/alert.tsx`) already exposes `default` and `destructive` variants through `class-variance-authority`.

## Goals / Non-Goals

Goals:

- A green success confirmation for the linked state, legible in both themes.

Non-Goals:

- Changing the unlinked, pending, expired or error states.
- Introducing a global success theme token or a toast system. The success look is scoped to this alert variant.

## Decisions

### A `success` Alert variant rather than one-off classes

Add a `success` variant next to `default` and `destructive`, using green border/background/text with a dark-theme text variant, and use it with the existing `Check` icon. Reusing the component keeps spacing and the icon layout consistent with the other states, and the variant is available to any future success message.

Alternative considered: inline green classes on the one alert. Rejected because it duplicates the Alert layout and leaves the success style unavailable elsewhere.

### Green that holds on both themes

The variant uses an emerald border and background at low opacity with a darker text colour for light mode and a lighter one for dark mode, so contrast stays readable on both. This mirrors how the `destructive` variant is built.

## Risks / Trade-offs

- [Green can be too loud if reused everywhere] → scoped to this one confirmation; the variant exists but is only used for the linked state.
- [Low-contrast green text on a green tint] → use a dark green in light mode and a light green in dark mode, matching the destructive variant's approach.

## Migration Plan

Web-only, presentational. Deploy the web build; roll back by reverting it. No state or API involved.

## Open Questions

None.

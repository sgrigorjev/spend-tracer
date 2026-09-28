## Context

See proposal.md for motivation. `parseMappingReply` in `shared/src/import/learn.ts` sets the bank to the reply's value when it is a string and to null otherwise. The model's strict schema allows a string, so it can return the text "null", which is stored verbatim. The role mapping already guards against a missing column written as the text "null"; the bank guard was not added.

## Goals / Non-Goals

**Goals:**

- Normalize a placeholder bank from the mapping to null.

**Non-Goals:**

- Sanitizing the manually entered bank name beyond the existing trim and cap; a user typing "null" is their choice.
- Any other mapping field. The roles already handle their own placeholder text.

## Decisions

### Normalize in the reply parser

`parseMappingReply` trims the bank and maps an empty string or the text null, none or n/a to null. This is the same rule the role validation uses, so there is one place that decides what counts as absent. Alternative: normalize in the pipeline when it stores the bank, which would spread the rule across two layers.

## Risks / Trade-offs

- A real bank literally named "none" would be dropped. No such bank is realistic, and the same rule already applies to mapping roles.

## Migration Plan

1. Normalize the bank in `parseMappingReply`.
2. Add a test for a placeholder and a real name.

No schema change. Existing rows that already stored the text `null` keep it until the profile is re-learned. Rollback is a revert of the commit.

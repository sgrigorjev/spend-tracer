## Why

The model sometimes returns the literal text "null" for the bank in a generated mapping, and the mapping parser stores it as a name. The profile and the statement then record the string `null` instead of no bank, which is what the real PrivatBank import produced.

## What Changes

- Treat a placeholder bank value from the mapping, such as an empty string or the text null, none or n/a, as no bank.
- Store null on the profile and the statement in that case, so a placeholder never reaches storage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bank-import`: a mapping placeholder for the bank is normalized to no bank.

## Impact

- `shared/src/import/learn.ts`: the mapping reply parser normalizes the bank value.
- `bot/test/import.test.ts`: a test that a placeholder stores null and a real name is kept.

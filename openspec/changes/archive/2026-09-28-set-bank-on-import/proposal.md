## Why

An imported statement has no bank name: the model cannot infer it from the parsed columns, and the profile stores null, so the expense detail shows no bank. The user wants to type it while importing. Managing and renaming profiles from the settings UI is a later change.

## What Changes

- Let the user enter the bank name when confirming a newly learned import profile, through a prompt or a command-line flag.
- Store the entered name on the profile and copy it to the statement the import creates, overriding whatever the model returned.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bank-import`: profile confirmation accepts a user-supplied bank name and stores it on the profile.

## Impact

- `shared/src/import/pipeline.ts`: the profile-confirmation callback may return a bank name.
- `shared/src/db.ts`: a store method to set the bank name on a profile.
- `bot/src/cli/import.ts`: a `--bank` flag and a prompt during confirmation.
- Managed and renamed profiles in the settings UI are a later change.

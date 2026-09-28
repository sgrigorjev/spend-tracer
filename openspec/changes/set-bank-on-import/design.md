## Context

See proposal.md for motivation. Current state that shapes the approach:

- `importStatement` in `shared/src/import/pipeline.ts` takes a `ProfileConfirmer` dependency that currently returns a boolean. On a learned profile it saves the profile as draft, shows a preview, and on confirmation marks it verified and copies `mapping.bank` to the statement and the profile.
- `bot/src/cli/import.ts` is the only host of the confirmer. It prints the preview and reads a yes/no answer from stdin. There is no bot or web surface yet.
- `import_profiles` already has a nullable `bank` column, and `bank_statements.bank` is set from it at import.

## Goals / Non-Goals

**Goals:**

- Let the user set the bank name at import confirmation, by prompt or flag.
- Store it on the profile and record it on the statement.

**Non-Goals:**

- Renaming or managing existing profiles from the settings UI. Separate later change.
- Setting the bank on a reused profile: a reused profile keeps its stored name.
- Any model-based inference of the bank.

## Decisions

### The confirmer returns a result, not a boolean

`ProfileConfirmer` becomes `(preview) => Promise<{ confirmed: boolean; bank?: string | null }>`. When `bank` is present it overrides the mapping's name; when absent the mapping's name is kept. This keeps the decision and the value in one round trip and avoids a second callback. Alternative: a separate `resolveBank` dependency, which adds a second interactive step for no benefit.

### Store the override on the profile

The profile is saved as a draft with the mapping's bank before confirmation. On confirmation, if the user supplied a name, a new `setProfileBank(userId, fingerprint, bank)` updates the row before it is marked verified, so the stored profile matches the statement it produced. The pipeline uses the resolved name for the statement it creates.

### Prompt and flag in the CLI

`bot/src/cli/import.ts` gains a `--bank <name>` flag and, in the confirmation prompt, a bank-name question whose default is the mapping's name (or none). `--yes` skips the question: with `--bank` it uses the flag, otherwise it keeps the mapping's name. The entered value is trimmed, and an empty entry keeps the default.

## Risks / Trade-offs

- Changing the confirmer contract touches the only host, the CLI. The bot surface is not wired yet, so nothing else implements it. Mitigated by the pipeline test updating the stub.
- A user could enter a very long or odd value. Mitigated by trimming and capping the stored length.
- A reused profile still shows the old null bank until the format is re-learned or the future UI renames it. Accepted and stated as a non-goal.

## Migration Plan

1. Change the confirmer contract and add `setProfileBank`, updating the pipeline test.
2. Add the flag and prompt to the CLI.
3. Verify by re-learning a profile with a typed bank name against a scratch database.

No schema change and no data migration. Rollback is a revert of the commit.

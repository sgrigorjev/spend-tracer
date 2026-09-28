# Review

Independent review of the branch against `main` before the PR, run with the reviewer subagent.

## Findings and dispositions

### 1. The design claimed a length cap that was not implemented (medium) — applied

`shared/src/import/pipeline.ts`. A user-supplied bank name is now trimmed and capped at 120 characters before it is stored, matching the design's mitigation.

### 2. Test coverage did not back the spec scenarios (low) — applied

`bot/test/import.test.ts`. The override test now also asserts the statement bank through `findLinkedTransaction`, and a new test asserts that a confirmation without a bank name keeps the mapping's name.

### 3. `null` versus `undefined` in the confirmation contract was a subtle footgun (low) — applied

`shared/src/import/pipeline.ts`. The `ProfileConfirmation.bank` comment now states that omitting the field keeps the mapping's name and that setting it, including to null, overrides.

### 4. `--bank` with a missing value is treated as no flag (low) — declined

`bot/src/cli/import.ts`. The parser behaves the same for `--file` and `--email`, so this is inherited and consistent. Changing only one flag's error handling would make the parser inconsistent; a shared fix is a separate cleanup.

## Verdict after fixes

The confirmation contract, store update, and CLI prompt are correct. The medium finding and both coverage and documentation findings are applied; the remaining nit is declined with a reason.

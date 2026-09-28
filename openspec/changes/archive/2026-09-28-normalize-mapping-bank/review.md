# Review

Independent review of the branch against `main` before the PR, run with the reviewer subagent.

## Findings and dispositions

### 1. The test under-covered the stated rule (minor) — applied

`bot/test/import.test.ts`. Added assertions for `none`, `N/A`, mixed-case `Null`, an empty string, a non-string and a real name, so the case-insensitive branch is exercised.

### 2. The spec said a real name is kept unchanged, but it is trimmed (nit) — applied

`openspec/changes/normalize-mapping-bank/specs/bank-import/spec.md`. The wording now says a real name is kept, since the value is trimmed before storage, matching the manual-entry path.

## Verdict after fixes

The normalization is correct and does not affect the roles or directives, and it does not interact badly with the manual bank override. Both review points are applied.

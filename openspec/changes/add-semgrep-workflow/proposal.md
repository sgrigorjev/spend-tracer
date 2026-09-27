## Why

Nothing static-analyzes the code on pull requests. gitleaks only catches committed secrets; semgrep adds rule-based checks for security and correctness across the TypeScript, Node, React, Docker and nginx files the repo already ships.

## What Changes

- Add `.github/workflows/semgrep.yml`: run Semgrep CE on every pull request and on manual dispatch, using the official `semgrep/semgrep` container and a curated set of registry rulesets.
- Fail the job on any finding (`--error`), so a red check can gate the merge once branch protection requires it.

## Capabilities

None. This is CI tooling with no product behavior, so the change declares `skip_specs: true`.

## Impact

- `.github/workflows/semgrep.yml`.
- No product code, API or spec change.
- The gate only bites with a branch protection rule on `main` that requires the semgrep check.

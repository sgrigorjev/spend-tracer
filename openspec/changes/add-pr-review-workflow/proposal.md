## Why

The repo has no first-pass code review before a PR opens, and the only reviewer is CodeRabbit once the PR exists. A repo-local reviewer lets a branch be checked against its OpenSpec change and the repo conventions before opening the PR, and doing it on a different model than the one that wrote the code gives a genuinely independent read.

## What Changes

- Add a read-only `reviewer` subagent at `.opencode/agents/reviewer.md`, pinned to `google/gemini-3.1-pro-preview`, a different vendor from the default implementation model.
- Add a `/review` command at `.opencode/commands/review.md` that runs the reviewer on the current branch's diff against `origin/main`.
- Add a rule to `AGENTS.md`: run `/review` before opening a PR, and address or explicitly decline every finding.

## Capabilities

None. This is developer tooling and documentation, with no change to product behavior, so the change declares `skip_specs: true`.

## Impact

- `.opencode/agents/reviewer.md`, `.opencode/commands/review.md`, `AGENTS.md`.
- No product code, no API and no spec change.
- Uses the already-authenticated Google provider; no new credential.

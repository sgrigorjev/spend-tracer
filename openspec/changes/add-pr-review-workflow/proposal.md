## Why

The repo has no first-pass code review before a PR opens, and the only reviewer is CodeRabbit once the PR exists. A repo-local reviewer lets a branch be checked against its OpenSpec change and the repo conventions before opening the PR, and running it on a stronger model than the one that wrote the code gives a second read that does not simply repeat the author's own assumptions.

## What Changes

- Add a read-only `reviewer` subagent at `.opencode/agents/reviewer.md`, pinned to `deepseek/deepseek-v4-pro`, a stronger model than the default implementation model.
- Add a `/review` command at `.opencode/commands/review.md` that runs the reviewer on the current branch's diff against `origin/main`.
- Add a rule to `AGENTS.md`: run `/review` before opening a PR, and address or explicitly decline every finding.

## Capabilities

None. This is developer tooling and documentation, with no change to product behavior, so the change declares `skip_specs: true`.

## Impact

- `.opencode/agents/reviewer.md`, `.opencode/commands/review.md`, `AGENTS.md`.
- No product code, no API and no spec change.
- Uses the DeepSeek provider, the same vendor as the default implementation model; the reviewer needs a valid DeepSeek credential with quota for the pinned model, since a stored credential alone does not guarantee the model is callable.

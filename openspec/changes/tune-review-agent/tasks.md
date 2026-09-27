# tune-review-agent

## 1. Reviewer configuration

- [x] 1.1 Add `steps: 25` and the `skill`, `lsp`, `websearch`, `"playwright_*"` and `"phpstorm_*"` denials to `.opencode/agents/reviewer.md`. Verify the frontmatter parses as YAML and the permission map is what is intended.
- [x] 1.2 Update the reviewer prompt: name context7 as the one allowed MCP server, search `openspec/changes/archive/<date>-<name>/`, read a file in full only when a hunk is not enough, keep within a step and token budget, and report findings then the verdict and file list. Verify the wording by reading the file.
- [x] 1.3 Make the reviewer judge behavior against the change's spec deltas and main specs when present, and against `AGENTS.md` conventions and the diff under `skip_specs`. Verify the prompt states both cases.
- [x] 1.4 After an opencode restart, run one review and verify it makes no browser or IDE-MCP call, uses context7 only as the documentation exception, and returns within the step cap. Done: the live review on this branch used context7 and no browser or IDE MCP, and completed with findings.

## 2. Project documentation

- [x] 2.1 Add the PR watching section to `AGENTS.md`: the external `pr-watch` caveat, no blocking checks, `gitleaks` and `semgrep` as the required gates, and checking CodeRabbit only when the PR is otherwise merge-ready. Verify the wording states all four.

## 3. Review

- [x] 3.1 Run the `reviewer` subagent on this branch and record every finding with its disposition in `openspec/changes/tune-review-agent/review.md`.

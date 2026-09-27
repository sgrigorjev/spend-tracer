# tune-review-agent

## 1. Reviewer configuration

- [x] 1.1 Add `steps: 25`, `skill: deny`, `lsp: deny`, `"playwright_*": deny` and `"phpstorm_*": deny` to `.opencode/agents/reviewer.md`. Verify the frontmatter parses as YAML and the permission map is what is intended.
- [x] 1.2 Update the reviewer prompt: the no-MCP line, change discovery in `openspec/changes/archive/`, reading a file in full only when a hunk is not enough, a step and token budget rule, and a findings-only report. Verify the wording by reading the file.
- [ ] 1.3 After an opencode restart, run one review and verify it calls no MCP tool and returns within the step cap.

## 2. Project documentation

- [x] 2.1 Add the PR watching section to `AGENTS.md`: the external `pr-watch` caveat, no blocking checks, `gitleaks` and `semgrep` as the required gates, and checking CodeRabbit only when the PR is otherwise merge-ready. Verify the wording states all four.

## 3. Review

- [ ] 3.1 Run the `reviewer` subagent on this branch and record every finding with its disposition in `openspec/changes/tune-review-agent/review.md`.

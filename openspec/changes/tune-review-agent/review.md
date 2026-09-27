# Review: tune-review-agent

Independent review of the branch diff (`reviewer` subagent) against `origin/main`, covering `.opencode/agents/reviewer.md` and the `AGENTS.md` PR watching section. The reviewer also verified the frontmatter shape against the opencode permission schema and confirmed that `gitleaks` and `semgrep` exist as PR checks while CodeRabbit is not required.

## Findings

| # | Severity | Finding | Disposition |
| - | -------- | ------- | ----------- |
| 1 | major | The prompt claimed the reviewer must not call any MCP tool, but only `playwright_*` and `phpstorm_*` were denied, so `context7` stayed callable and the claim was false. | Applied: the prompt now names context7 as the one allowed MCP server for documentation, and the proposal, design and prompt all say browser and IDE-terminal MCP are denied rather than "no MCP". Keeping context7 reachable is the intended decision. |
| 2 | minor | "Your only tools are file reads and searches plus git and gh" overstated the permission map. | Applied: reworded to name context7 as the documentation exception. |
| 3 | nit | "findings only" contradicted the required verdict and file list. | Applied: reworded to "findings, then the verdict and the file list". |
| 4 | nit | Archive discovery said `openspec/changes/archive/` without the dated `<date>-<name>` layout, risking wasted listing steps. | Applied: the prompt now names the `<date>-<name>` form. |

No findings declined.

## Process note

The reviewer read `.github/workflows/semgrep.yml`, a file outside the diff, because the review prompt asked it to confirm that the `gitleaks` and `semgrep` gates really are required. That was an instruction to verify an external fact, not the reviewer drifting. Keep future review prompts scoped to the diff and the change contract; do not ask the reviewer to confirm facts that live outside the branch.

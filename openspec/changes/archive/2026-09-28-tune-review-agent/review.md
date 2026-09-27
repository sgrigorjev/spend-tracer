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

## Second round: live review after restart

A second review ran on the branch after an opencode restart, with the new agent config active. It used context7 (the allowed documentation exception) and no browser or IDE-terminal MCP, and returned a full report within the step cap. That is the runtime verification for task 1.4.

| # | Severity | Finding | Disposition |
| - | -------- | ------- | ----------- |
| 1 | minor | `design.md:10` goal said "no browser, IDE, or MCP", contradicting the decision that keeps context7. | Applied: the goal now reads "no browser, IDE-terminal or web-search access, with context7 the one allowed MCP server for documentation". |
| 2 | minor | Task 1.3 (the live verification) was unchecked, so the config would ship unverified. | Applied: the live review ran and the task is marked done with the outcome recorded. |
| 3 | nit | Task 1.2 described the pre-review wording ("no-MCP line", "findings-only report"). | Applied: rewritten to the final wording. |
| 4 | nit | Tasks were numbered out of order. | Applied: renumbered so order matches execution. |
| 5 | nit | `websearch` was not denied, so the reviewer could still reach the network and undercut the containment goal. | Applied: added `websearch: deny`, leaving context7 as the only external tool. |

No findings declined.


## Why

The independent review is slower and more expensive than it needs to be, and watching a PR blocks the session. The reviewer had no iteration cap, could load skills and probe the LSP, read every changed file in full, and looked for the change only under `openspec/changes/`, wasting steps after a change is archived. Separately, waiting on CI and CodeRabbit used a blocking `gh pr checks --watch`.

## What Changes

- Cap the reviewer at 25 agentic steps so it must return findings instead of looping.
- Deny the reviewer the `skill` and `lsp` permissions.
- Deny the reviewer the browser and IDE-terminal MCP tools so it cannot leave the repository; it keeps file reads, git, gh, and context7 as the one allowed MCP server for documentation.
- Point change discovery at `openspec/changes/archive/` as well as `openspec/changes/`.
- Tell the reviewer to judge behavior against the change's spec deltas and the main specs when they exist, and against the `AGENTS.md` conventions and the diff when the change declares `skip_specs`.
- Tell the reviewer to read a changed file in full only when a hunk is not enough, to work within a step and token budget, and to keep the report to findings with no preamble.
- Document in `AGENTS.md` that the external `pr-watch` skill assumes a blocking loop this environment lacks: never block the session on checks, `gitleaks` and `semgrep` are the required gates, and CodeRabbit is checked only when the PR is otherwise merge-ready.

## Capabilities

None. This is tooling and documentation; no product behavior changes, so the change declares `skip_specs: true`.

## Impact

- `.opencode/agents/reviewer.md`: permissions, `steps`, and prompt.
- `AGENTS.md`: a new PR watching section.
- No application, API, schema or deployment change.

## Why

The first real use of the review workflow exposed two gaps. The review was run by shelling out to `opencode run --command review`, which starts a fresh top-level session where the command executes in the primary agent, so the `reviewer` subagent never ran and the pass was not independent. And the findings and their dispositions were never written down, so the review left no durable trace.

## What Changes

- `AGENTS.md`: state that the review runs by spawning the `reviewer` subagent (Task tool with `subagent_type: reviewer`, or `@reviewer` in the TUI), never via `opencode run --command review`, and that every finding and its disposition goes to `openspec/changes/<name>/review.md`.
- `.opencode/commands/review.md` and `.opencode/agents/reviewer.md`: note the intended invocation and the recording step, so the files are self-describing.
- Record the review that was already run for `build-dashboard-ui` in its change folder.

## Capabilities

None. Developer tooling and documentation, no product behavior, so the change declares `skip_specs: true`.

## Impact

- `AGENTS.md`, `.opencode/commands/review.md`, `.opencode/agents/reviewer.md`.
- No product code, no API and no spec change.

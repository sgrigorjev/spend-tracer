## Context

See `proposal.md` for motivation. The review workflow shipped in `add-pr-review-workflow` (archived): `.opencode/commands/review.md`, `.opencode/agents/reviewer.md`, and an `AGENTS.md` rule. Its first use on `build-dashboard-ui` (PR #42) showed that the rule did not say how to invoke the reviewer, so the review was run through the CLI and executed in the primary agent, and that nothing recorded the findings.

## Goals / Non-Goals

**Goals:**

- A future session invokes the reviewer correctly from the start.
- Every review leaves a durable record of findings and dispositions.

**Non-Goals:**

- Changing the reviewer's prompt, model or read-only permissions.
- A GitHub Actions reviewer.

## Decisions

### Invoke through the Task tool, never the CLI

The reviewer is a subagent, so it is spawned from an agent session: the Task tool with `subagent_type: reviewer`, or `@reviewer` in the TUI. The `opencode run --command review` path starts a new top-level session and runs the command in the primary agent, so the subagent never starts; the AGENTS.md rule names this failure explicitly so the next session does not repeat it.

### Record the outcome in the change, not in chat

Findings and dispositions go to `openspec/changes/<name>/review.md`, one row per finding with severity, location, the finding, and the disposition (applied in a commit, or declined with a reason). The file sits with the change, so it travels into `openspec/changes/archive/` and is never lost. `openspec validate` and `status` ignore extra files in a change, so the record does not disturb the artifact graph.

### The files describe their own use

`review.md` and `reviewer.md` each carry a short note about the intended invocation and the recording step, so a reader of the workflow files sees the contract without reading `AGENTS.md`.

## Risks / Trade-offs

- **The rule competes for space in a file read every session.** → Two short sentences, and the failure mode they prevent is concrete and already observed.
- **`review.md` could be forgotten.** → It is part of the same rule, and an archived change without one is a visible gap.

## Open Questions

- Whether a later step should validate that a change carries `review.md` before it is archived.

## Context

The reviewer is a read-only subagent (`.opencode/agents/reviewer.md`) spawned by the `review` command. Review cost is driven by the number of agentic steps, since each step re-sends the growing context, and by how much it reads and writes. See proposal.md for the problem statement.

## Goals / Non-Goals

**Goals:**

- Fewer steps and fewer tokens per review without weakening what it checks.
- Keep the reviewer inside the repository: no browser, IDE, or MCP.
- Document how to watch a PR without blocking the session.

**Non-Goals:**

- Changing the reviewer's model or its checklist.
- Skipping review for documentation-only changes (possible later, not now).
- Editing the external `pr-watch` skill.

## Decisions

### Cap steps at 25

`steps: 25` bounds the loop. A focused review needs well under that: read `AGENTS.md`, the change, the diff, a few files, then report. Past the cap the agent must answer, so a runaway cannot spin. Chosen over no cap, which let the reviewer wander (for example into MCP) and over a tighter cap that risks cutting a large review short.

### Deny skill, lsp and the browser/IDE MCP tools

`skill` and `lsp` are denied because neither is needed to judge a diff. `playwright_*` and `phpstorm_*` are denied because they let the reviewer leave the repository; the observed failure was reviewing a semgrep PR by browsing docs and running bash through the IDE terminal, which bypassed its bash allowlist. The denial is deliberately not extended to context7: it is the one allowed MCP server, for looking up library or tool documentation when the code depends on an external API. The prompt names context7 as that exception rather than claiming no MCP at all, so the instruction matches the permissions.

### Read the diff first, full files only when needed

The old prompt required reading every changed file in full. The new one reads a file in full only when a hunk is not enough, which cuts tokens on large diffs while keeping the ability to inspect context.

### Search the archive for the change

Change discovery now checks `openspec/changes/archive/` too, so a PR that archives a change does not send the reviewer looking in the wrong place.

## Risks / Trade-offs

- The step cap could truncate a very large review. Mitigation: 25 is generous for this repo's small, single-purpose PRs; if a review is cut short, the cap is one number to raise.
- Denying tools removes a fallback for verifying external behavior. Accepted: the reviewer reports findings, and the primary agent owns external lookups.

## Migration Plan

Not applicable. The agent config takes effect on the next opencode restart; no runtime state changes.

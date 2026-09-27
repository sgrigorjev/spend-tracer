## 1. Rules

- [x] 1.1 Rewrite the `AGENTS.md` code-review section: run the review by spawning the `reviewer` subagent (Task tool with `subagent_type: reviewer`, or `@reviewer`), never `opencode run --command review`; and record every finding with its disposition in `openspec/changes/<name>/review.md`.
- [x] 1.2 Add a short note to `.opencode/commands/review.md` and `.opencode/agents/reviewer.md` about the intended invocation and the recording step.

## 2. Verification

- [x] 2.1 Confirm the workflow works end to end: the reviewer runs when spawned via the Task tool (it did on `build-dashboard-ui`), and that change carries a `review.md` with a disposition per finding.

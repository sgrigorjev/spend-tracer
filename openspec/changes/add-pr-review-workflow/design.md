## Context

See `proposal.md` for motivation. What shapes the approach:

- opencode supports project agents in `.opencode/agents/` and project commands in `.opencode/commands/`, both markdown with frontmatter. An agent can pin its own `model` and restrict its permissions.
- The repo already uses OpenSpec, so a branch usually carries an `openspec/changes/<name>/` folder with the intent, the acceptance criteria and the tasks, plus `AGENTS.md` conventions. That is the contract a reviewer should check the code against.
- `opencode auth list` shows Google and DeepSeek already authenticated, so a Google model is available with no new credential.
- CodeRabbit stays the post-PR gate; this is the pre-PR pass, run locally.

## Goals / Non-Goals

**Goals:**

- One command, `/review`, that a developer or the agent runs before opening a PR.
- A read-only reviewer that cannot edit, and that reports findings with a file, a line and a concrete fix.
- An independent model, so the review does not share the implementation model's blind spots.

**Non-Goals:**

- Replacing CodeRabbit, or reviewing a PR that is already open.
- A GitHub Actions reviewer; that is a later, separate change.
- Reviewing product behavior at runtime or running the app.

## Decisions

### A subagent plus a command, not a plugin

The reviewer is an agent, so it has its own system prompt, its own model and its own permissions, and the `/review` command wires `agent: reviewer` with `subtask: true` so the review runs in an isolated context and does not pollute the main session. A plugin would add code and hooks for no gain at this stage. The command stays a thin prompt; the substance lives in the agent.

### A different vendor for the model

The reviewer runs on `google/gemini-3.1-pro-preview` while implementation runs on `deepseek/deepseek-flash`. Same-vendor review shares the same training biases and tends to agree with the author; a different vendor is the cheap way to buy independence. The model is one line in the agent frontmatter and can be changed or overridden.

### Read-only, deny by default

The agent sets `edit: deny` and restricts bash to `git *` and `gh *`, with everything else denied, so it cannot change the code it is reviewing. It reports findings; a human or the primary agent applies them.

### Ground the review in the change and the conventions

The prompt requires reading `AGENTS.md`, the `openspec/changes/<name>/` folder and the relevant `openspec/specs/` before judging, and checking the code against them. A diff reviewed without the agreed intent only catches style. The prompt also asks the reviewer to verify each claim in the code rather than trust the diff or a summary, and to separate observed facts from assumptions.

### A fixed output shape

Each finding carries a severity, a `file:line`, why it is wrong, and a concrete fix, followed by a short verdict and the list of files reviewed. This makes the output actionable and easy to check off, and matches how CodeRabbit already reports.

## Risks / Trade-offs

- **Model cost per run.** → It runs on demand before a PR, not on every save; the model can be swapped for a cheaper one in the agent frontmatter.
- **False positives or nitpick noise.** → The prompt asks for real problems with a concrete fix and forbids praise padding; findings can be declined with a reason.
- **The reviewer agreeing with the author anyway.** → A different vendor, a low temperature and an explicit "you did not write this, find what is wrong" instruction reduce it; the standing rules in `AGENTS.md` still apply.
- **The agent config drifting from the docs.** → Both files are plain markdown under `.opencode/`, reviewed like any other file.

## Open Questions

- Whether to add a GitHub Actions reviewer later, and whether it reuses this agent.
- Whether `/review` should default to `origin/main` or take the base ref as an argument for stacked branches.

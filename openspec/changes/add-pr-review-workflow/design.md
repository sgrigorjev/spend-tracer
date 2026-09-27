## Context

See `proposal.md` for motivation. What shapes the approach:

- opencode supports project agents in `.opencode/agents/` and project commands in `.opencode/commands/`, both markdown with frontmatter. An agent can pin its own `model` and restrict its permissions.
- The repo already uses OpenSpec, so a branch usually carries an `openspec/changes/<name>/` folder with the intent, the acceptance criteria and the tasks, plus `AGENTS.md` conventions. That is the contract a reviewer should check the code against.
- The reviewer needs a model the account can actually call with enough quota for an agentic pass, which makes many model calls. A stored credential is not the same as a usable model, and confirming that is a prerequisite rather than a given.
- CodeRabbit stays the post-PR gate; this is the pre-PR pass, run locally.

## Goals / Non-Goals

**Goals:**

- One command, `/review`, that a developer or the agent runs before opening a PR.
- A read-only reviewer that cannot edit, and that reports findings with a file, a line and a concrete fix.
- An independent model, so the review does not share the implementation model's blind spots.

**Non-Goals:**

- Replacing CodeRabbit as the post-PR gate; the reviewer is the pre-PR pass, though it can inspect an open PR's diff on request.
- A GitHub Actions reviewer; that is a later, separate change.
- Reviewing product behavior at runtime or running the app.

## Decisions

### A subagent plus a command, not a plugin

The reviewer is an agent, so it has its own system prompt, its own model and its own permissions, and the `/review` command wires `agent: reviewer` with `subtask: true` so the review runs in an isolated context and does not pollute the main session. A plugin would add code and hooks for no gain at this stage. The command stays a thin prompt; the substance lives in the agent.

### A different, stronger model

The reviewer runs on `deepseek/deepseek-v4-pro` while implementation runs on `deepseek/deepseek-flash`. The intent was a different vendor for true independence, but the free Google tier cannot sustain an agentic review pass, which makes many model calls, so the reviewer currently uses a stronger model from the same vendor instead, and the vendor switch stays an open question. The pinned model must have quota for many calls, otherwise the run fails and the primary model falls back, which defeats the point; a one-line `opencode run -m <model> "ok"` confirms it before relying on it. The model is one line in the agent frontmatter and can be changed or overridden.

### Read-only, deny by default

The agent sets `edit: deny` and allows only read-only bash subcommands (`git diff`, `git status`, `git log`, `git show`, `git rev-parse`, `git ls-files`, `gh pr view`, `gh pr diff`), with everything else denied, so it cannot change the code it is reviewing. It reports findings; a human or the primary agent applies them.

### Ground the review in the change and the conventions

The prompt requires reading `AGENTS.md`, the `openspec/changes/<name>/` folder and the relevant `openspec/specs/` before judging, and checking the code against them. A diff reviewed without the agreed intent only catches style. The prompt also asks the reviewer to verify each claim in the code rather than trust the diff or a summary, and to separate observed facts from assumptions.

### A fixed output shape

Each finding carries a severity, a `file:line`, why it is wrong, and a concrete fix, followed by a short verdict and the list of files reviewed. This makes the output actionable and easy to check off, and matches how CodeRabbit already reports.

## Risks / Trade-offs

- **Model cost per run.** → It runs on demand before a PR, not on every save; the model can be swapped for a cheaper one in the agent frontmatter.
- **False positives or nitpick noise.** → The prompt asks for real problems with a concrete fix and forbids praise padding; findings can be declined with a reason.
- **The reviewer agreeing with the author anyway.** → A stronger model than the author's, a low temperature and an explicit "you did not write this, find what is wrong" instruction reduce it, and moving to another vendor later would strengthen it; the standing rules in `AGENTS.md` still apply.
- **The agent config drifting from the docs.** → Both files are plain markdown under `.opencode/`, reviewed like any other file.

## Open Questions

- Whether to add a GitHub Actions reviewer later, and whether it reuses this agent.
- Which vendor to move the reviewer to for full independence, once a credential with quota for an agentic pass exists; the free Google tier cannot sustain one.

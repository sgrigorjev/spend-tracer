## 1. Reviewer subagent

- [x] 1.1 Add `.opencode/agents/reviewer.md`: a `subagent` on `google/gemini-3.8-flash`, temperature 0.1, `edit: deny`, bash limited to a read-only git/gh allowlist, with a prompt that reviews the branch against `AGENTS.md`, the `openspec/changes/<name>/` folder and the relevant specs, and reports findings as severity, `file:line`, reason and fix. Verify with `opencode agent list` that `reviewer` is registered.

## 2. Review command

- [x] 2.1 Add `.opencode/commands/review.md` wired to the reviewer with `agent: reviewer` and `subtask: true`, taking the base ref from `$ARGUMENTS` and defaulting to `origin/main`. Verify the command appears and that running it produces findings without editing files.

## 3. Convention

- [x] 3.1 Add a rule to `AGENTS.md`: before opening a PR, run `/review` on the branch diff and address or explicitly decline every finding, noting that the reviewer is read-only and never edits.

## 4. Verification

- [ ] 4.1 Run `/review` on this branch's own diff and confirm it returns findings with locations, does not modify any file, and that `git status` is unchanged afterwards.

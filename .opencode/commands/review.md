---
description: Independent read-only review of the current branch against a base ref
agent: reviewer
subtask: true
---

Review the changes on the current branch against the base ref given in $ARGUMENTS, or `origin/main` when no argument is given.

Cover the committed diff (`git --no-pager diff <base>...HEAD`) and anything still uncommitted or untracked (`git --no-pager status --short`), read every changed file in full, and review it against `AGENTS.md` and the OpenSpec change carried on the branch. Report findings in the format from your agent prompt, and do not edit anything.

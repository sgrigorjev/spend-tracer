# add-dependabot

## 1. Dependabot configuration

- [x] 1.1 Add npm entries for `/bot`, `/api` and `/web`, weekly, grouping minor and patch. `shared/` has no dependencies and no lockfile, so it is omitted. Verify the file parses as YAML and lists three npm entries.
- [x] 1.2 Add docker entries for `/bot`, `/api` and `/web`. Verify three docker entries and that each directory holds a Dockerfile; `nginx:alpine` in `web/` stays untracked because the tag carries no version.
- [x] 1.3 Add a github-actions entry for `/`. Verify the file parses and the four ecosystems are all present.

## 2. Review

- [x] 2.1 Run the `reviewer` subagent on this branch and record every finding with its disposition in `openspec/changes/add-dependabot/review.md`.

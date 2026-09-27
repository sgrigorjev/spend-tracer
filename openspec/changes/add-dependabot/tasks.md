# add-dependabot

## 1. Dependabot configuration

- [x] 1.1 Add npm entries for `/bot`, `/api`, `/shared` and `/web` to `.github/dependabot.yml`, weekly, grouping minor and patch. Verify the file parses as YAML and lists four npm entries.
- [x] 1.2 Add docker entries for `/bot`, `/api` and `/web`. Verify three docker entries and that each directory holds a Dockerfile.
- [x] 1.3 Add a github-actions entry for `/`. Verify the file parses and the four ecosystems are all present.

## 2. Review

- [ ] 2.1 Run the `reviewer` subagent on this branch and record every finding with its disposition in `openspec/changes/add-dependabot/review.md`.

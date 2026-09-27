# Review: tag-based-deploy

Independent review of the branch diff (`reviewer` subagent), covering `deploy/deploy.sh`, `deploy/test/deploy.test.sh`, `deploy/README.md`, `README.md`, `.gitignore` and the removed systemd units against the change's specs and design. The reviewer ran `bash -n` on both scripts and the shell test, all passing. No security findings: the version argument is validated before any git call and never passed through `eval`, and the ignored `.env`/`data/` are untouched by the checkout.

## Findings

| # | Severity | Finding | Disposition |
| - | -------- | ------- | ----------- |
| 1 | minor | `--status`/`--list` acquired the deploy lock before parsing, so they failed mid-deploy and created the lock file as a side effect. | Applied: the lock is taken only on the deploy path, after validation. |
| 2 | minor | The no-op guard ran after `git fetch`, so redeploying the running version failed offline instead of reporting `already deployed`. | Applied: the guard now runs before the fetch. |
| 3 | minor | A failed build left the checkout on the new tag while the state file named the old one, so a later no-op did not restore the tree. | Applied: the guard cross-checks `git describe --exact-match HEAD` and falls through to re-checkout when they diverge. |
| 4 | minor | The design promised a `git describe` cross-check when the state file is missing, but only `--status` used it. | Applied: the guard uses `git describe` as the fallback source of the deployed version. |
| 5 | minor | `docker image prune` ran between `docker compose up` and the state write, so a prune failure left a running version unrecorded. | Applied: the state file is written immediately after `up`; a prune failure is ignored. |
| 6 | minor | A non-zero `docker compose ps` under `set -e` could turn a successful deploy into a non-zero exit. | Applied: the trailing `ps` failure is ignored in both the deploy and `--status` paths. |
| 7 | minor | `--list` printed every tag, not only releases. | Applied: filtered to `v[0-9]*`. |
| 8 | minor | Tests did not cover lock contention, a populated `--status`, or `--list` ordering. | Applied: added all three cases plus stray-argument rejection and a git-ignore check. |
| 9 | nit | The usage string implied `--force` applies to `--status`/`--list`. | Applied: usage reads `<version> [--force]`, then `--status` or `--list`. |
| 10 | nit | Read-only flags silently ignored a stray version or `--force`. | Applied: an unexpected version or `--force` with `--status`/`--list` now fails with usage. |
| 11 | nit | README removed the units with `rm` while the design said "unlink". | Applied: the design now says "remove", matching the README. |
| 12 | nit | The new test file's executable bit was unverified because it was untracked. | Applied: `chmod +x` on both scripts before commit. |

No findings declined.

## CodeRabbit round

Second pass after the initial commit, from the CodeRabbit review on the PR. All eight findings applied.

| # | Location | Finding | Disposition |
| - | -------- | ------- | ----------- |
| 1 | deploy.sh:55 | `--list` used `v[0-9]*`, which also matched prereleases. | Applied: filtered with the anchored release pattern `^v[0-9]+\.[0-9]+\.[0-9]+$`; test asserts `v2.0.0-rc.1` is excluded. |
| 2 | deploy.sh:99 | A bare checkout was treated as proof of a deploy, so a failed first `docker compose up` was never retried. | Applied: the no-op guard now requires the `.deployed-version` record; `git describe` is only a drift cross-check. Test covers the retry. |
| 3 | deploy.sh:118 | `docker compose up -d` returns before a container that exits at startup is visible, so a broken release could be recorded as deployed. | Applied: `--wait --wait-timeout 120` aborts the deploy on an unhealthy stack before the state write. |
| 4 | deploy.sh:118 | Orphaned services from a newer release were left running after a rollback. | Applied: `--remove-orphans`; test asserts the flag on a rollback. |
| 5 | deploy/README.md:10 | `gh release create` can create a lightweight tag, contradicting the annotated-tag requirement. | Applied: create and push the annotated tag first, then `gh release create --verify-tag`. |
| 6 | deploy/README.md:44 | `chown data/` fails on a fresh clone where the gitignored directory does not exist. | Applied: `mkdir -p data` before the `chown`. |
| 7 | review.md:13 | Literal `\|` characters in table cells broke the Markdown table. | Applied: reworded the rows to avoid pipes. |
| 8 | tasks.md:1 | Document started at H2, failing MD041. | Applied: added an H1 title. |

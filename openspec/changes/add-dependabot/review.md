# Review: add-dependabot

Independent review of the branch diff (`reviewer` subagent) against `origin/main`, covering `.github/dependabot.yml` and the change artifacts. The reviewer checked every configured directory against the repo, the Dependabot schema, and consistency with `.github/release.yml`.

## Findings

| # | Severity | Finding | Disposition |
| - | -------- | ------- | ----------- |
| 1 | minor | `shared/package.json` has no dependencies and no lockfile, so the `/shared` npm entry can never produce a PR, and the design claimed all four projects have lockfiles. | Applied: the `/shared` entry is removed, and the proposal, design and tasks now say `shared/` is dependency-free and not listed. |
| 2 | minor | `web/Dockerfile`'s `nginx:alpine` is a floating tag, so Dependabot cannot update it; the design claimed both `web` `FROM` lines were covered. | Applied: the design, proposal and the config comment now state that `nginx:alpine` is left untracked until it is pinned to a version. Pinning the runtime image is a Dockerfile change, out of scope here. |
| 3 | nit | The header comment said major updates arrive on their own, but the `github-actions` group had no `update-types`, so it grouped majors too. | Applied: added `update-types: minor, patch` to the actions group, so the comment holds for every group. |

No findings declined.

## CI round: semgrep

The first push failed the `static analysis` check: semgrep's rule `package_managers.dependabot.dependabot-missing-cooldown` flagged one blocking finding per update entry, seven in total, because no entry set a `cooldown`. Applied: every entry now sets `cooldown.default-days: 7`, and the design records it as a supply-chain guard.

## Note

The reviewer confirmed the remaining checks pass: every directory holds the expected manifest or Dockerfile, the `groups` and `open-pull-requests-limit` keys are valid, skipping `docker-compose` is justified because it pins no `image:` tags, and the `dependabot` author is already excluded in `.github/release.yml`.

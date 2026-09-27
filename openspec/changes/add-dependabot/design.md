## Context

The repo has four independent npm projects (`bot/`, `api/`, `shared/`, `web/`), three Dockerfiles (`bot/`, `api/`, `web/`) and two workflow files. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**

- Keep npm dependencies, container base images and GitHub Actions current without manual tracking.
- Limit PR noise so the update PRs are actually reviewed.

**Non-Goals:**

- Auto-merging updates.
- Pinning or repinning action SHAs (Dependabot updates the existing pinned refs).

## Decisions

### One entry per npm project

Dependabot scans a single manifest per `directory`, and the four projects have separate `package.json` and lockfiles, so each gets its own entry. A single root entry would miss three of them.

### Docker per Dockerfile directory

The `docker` ecosystem reads `FROM` lines in the Dockerfiles, so it needs an entry for each of `bot/`, `api/` and `web/`. The `web` Dockerfile has two `FROM` lines (the Node build stage and `nginx:alpine`), and both are covered by the one `web/` entry.

### Skip docker-compose

`docker-compose.yml` uses `build:` only and pins no `image:` tags, so the `docker-compose` ecosystem would find nothing. Adding it would be noise.

### Weekly schedule with minor/patch groups

Weekly is enough for a personal repo. Grouping minor and patch updates per ecosystem turns many small PRs into one, while majors still arrive individually so they get a closer look.

## Risks / Trade-offs

- A grouped PR mixes several updates, so a failure is less obvious. Mitigation: the required `gitleaks` and `semgrep` checks still gate every PR.
- Dependabot PRs consume CI minutes. Accepted; they are excluded from release notes by author in `.github/release.yml`.

## Migration Plan

Not applicable. Dependabot starts from the config on merge.

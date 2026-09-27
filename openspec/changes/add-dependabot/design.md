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

Dependabot scans a single manifest per `directory`. `bot/`, `api/` and `web/` each have their own `package.json` and lockfile, so each gets an entry. A single root entry would miss the three. `shared/` has no dependencies and no lockfile, so it is not listed.

### Docker per Dockerfile directory

Dependabot reads `FROM` lines and only updates tags it can interpret as a version. Entries cover `bot/`, `api/` and `web/`. In `web/`, the `node:24-alpine` build stage is trackable, but `nginx:alpine` is a floating tag and is left untouched until it is pinned to a version. That omission is deliberate, not an oversight.

### A 7-day cooldown on every entry

Each entry sets `cooldown.default-days: 7`, so a version published in the last week is not proposed. That is a supply-chain guard against a freshly published malicious or broken release, and the repo's semgrep rule `dependabot-missing-cooldown` blocks a config without it.

### Skip docker-compose

`docker-compose.yml` uses `build:` only and pins no `image:` tags, so the `docker-compose` ecosystem would find nothing. Adding it would be noise.

### Weekly schedule with minor/patch groups

Weekly is enough for a personal repo. Grouping minor and patch updates per ecosystem turns many small PRs into one, while majors still arrive individually so they get a closer look.

## Risks / Trade-offs

- A grouped PR mixes several updates, so a failure is less obvious. Mitigation: the required `gitleaks` and `semgrep` checks still gate every PR.
- Dependabot PRs consume CI minutes. Accepted; they are excluded from release notes by author in `.github/release.yml`.

## Migration Plan

Not applicable. Dependabot starts from the config on merge.

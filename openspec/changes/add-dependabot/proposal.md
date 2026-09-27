## Why

Dependencies, container base images and GitHub Actions are bumped by hand, so they drift and security updates sit unnoticed. Dependabot opens the update PRs automatically.

## What Changes

- Add `.github/dependabot.yml` with weekly updates for:
  - npm in `bot/`, `api/` and `web/` (each has its own lockfile; `shared/` is dependency-free and is not listed);
  - Docker base images in `bot/`, `api/` and `web/`;
  - GitHub Actions used by the workflows.
- Group minor and patch updates per ecosystem to keep the PR count down.
- Dependabot PRs stay out of release notes: `.github/release.yml` already excludes the `dependabot` author.

## Capabilities

None. This is CI tooling with no product behavior change, so the change declares `skip_specs: true`.

## Impact

- New `.github/dependabot.yml`.
- No application, API, schema or deployment change.

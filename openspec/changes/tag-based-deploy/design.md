## Context

See proposal.md for motivation and the specs for the behavior contract.

Current state: the server keeps a full checkout at `/home/ubuntu/projects/spend-tracer` whose only job is to serve the Docker stack. `deploy/deploy.sh` fast-forwards `main` and runs `docker compose up -d --build`; a systemd timer invokes it every 5 minutes. `.env` and `data/` are gitignored. The repo is private and the server reaches GitHub over SSH with `StrictHostKeyChecking=accept-new`.

## Goals / Non-Goals

**Goals:**

- Deploy an explicitly named release tag, and roll back by deploying an earlier one.
- Keep the existing pull-based model: the server fetches from GitHub, GitHub never connects in.
- No new infrastructure: build on the server as today.

**Non-Goals:**

- Building images in CI and pulling them from a registry. Recorded here as future work, not part of this change.
- Automatic version bumping, changelog tooling or release gating in CI.
- Multi-project concerns: the command stays repo-local and is never installed globally.

## Decisions

### Deploy by detached checkout of the tag

The deployment checkout switches to the tag with `git checkout --force --detach vX.Y.Z`. The checkout has no other purpose, so pinning it to a tag is safe and needs no second working tree. `.env` and `data/` are gitignored, so a checkout cannot touch them.

Alternatives considered: a `git worktree` per release (extra state to manage, no benefit for a single deployment target) and image-based deploys from GHCR (defers, needs registry auth, larger change).

### No automatic trigger; run by hand

The systemd timer and the argument-less service are removed. Nothing deploys without the operator running the script. Containers keep `restart: unless-stopped`, so a reboot still brings the stack back without the timer. Losing the timer is the point: it is what made every merge go live.

### Version is validated, then normalized to a canonical tag

The argument is matched against a strict `^v?[0-9]+\.[0-9]+\.[0-9]+$` pattern and normalized to `refs/tags/vX.Y.Z`. A version that fails the pattern, or a tag that does not exist locally after `git fetch --tags --prune`, aborts before anything changes. The validated value is passed quoted to git, never through `eval`, so no shell injection is possible from the version argument.

### Deployed version recorded in a state file

`.deployed-version` (gitignored) holds the tag of the last successful deploy and is the source of truth for the no-op guard and `--status`. It is written only after the stack comes up, so it always reflects what actually came up, not just what was checked out. A missing file means no deploy has succeeded yet, so the script retries rather than treating a bare checkout as done. `git describe --tags --exact-match HEAD` only cross-checks that the checkout has not drifted off the recorded version; it is never proof of a deploy.

### Serialize with flock

The script takes `flock -n` on a lock file. A second invocation exits immediately with a message rather than queueing a second rebuild. Failing fast keeps behaviour obvious and avoids a backlog of stale deploys.

## Security

- No new secrets or credentials. The env file stays out of version control and is untouched by checkout.
- The only untrusted input is the version argument; strict validation and quoted, non-`eval` use close the injection path.
- `git checkout --force` only affects tracked files, so the ignored env file and data directory are out of reach of a bad tag.
- Tags are never moved, and `--prune-tags` keeps the local tag list aligned with the remote, so the name maps to one commit.

## Risks / Trade-offs

- A detached HEAD on the server is unusual and someone might run `git pull` there by accident. Mitigation: the deploy README states the checkout is a deployment target and the script is the only supported way to change it.
- `git checkout --detach` removes tracked files that were added after the tag. They are recreated by a later deploy; ignored `.env` and `data/` are unaffected. Acceptable.
- Building on the server is slower than pulling a prebuilt image and needs the Node toolchain there. Accepted for now; the GHCR path is future work.
- Re-pushing a tag would silently change the commit behind a version. Mitigation: treat tags as immutable by rule; the deploy script does not fetch forced tag updates beyond what `--prune-tags` gives.

## Migration Plan

1. Merge the change and remove the timer: `sudo systemctl disable --now spend-tracer-deploy.timer`, remove both units, `systemctl daemon-reload`.
2. Cut the first release tag on the current `main` and run `deploy/deploy.sh v1.0.0` once by hand. The checkout moves to a detached HEAD.
3. Subsequent deploys name a version. Rollback is deploying the previous version tag.

## Open Questions

- The value of the first release tag (`v1.0.0` or something else) can be chosen when the first release is cut; it does not affect the design or the tasks.

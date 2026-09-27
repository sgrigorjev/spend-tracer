## Why

The server tracks `main` and redeploys automatically every 5 minutes, so every merge goes live unreviewed and there is no way to name, pin or roll back what is running. Cutting GitHub releases and deploying a specific tag makes rollouts deliberate and reversible.

## What Changes

- A release is an annotated semver tag `vX.Y.Z` on GitHub, created and pushed by hand and then published as a GitHub Release with generated notes (`git tag -a vX.Y.Z && git push origin vX.Y.Z && gh release create vX.Y.Z --verify-tag --generate-notes`). Tags are never moved.
- `deploy/deploy.sh <version>` deploys one tag: fetch tags, resolve and validate the version, check out the tag detached, rebuild and restart the stack, then record the deployed version. Repeated deploys of the same tag are a no-op unless `--force`.
- The version argument accepts `1.0.0` or `v1.0.0`; both resolve to `refs/tags/v1.0.0`.
- Add `--status` (current tag plus `docker compose ps`) and `--list` (recent release tags) subcommands, and a lock so two deploys cannot overlap.
- **BREAKING**: remove the automatic deploy. The systemd timer and the argument-less pull-`main` flow are gone; `deploy.sh` now requires a version argument. Env (`env`) and data (`data/`) stay untouched by a tag checkout.

## Capabilities

### New Capabilities

- `deployment`: how a release is cut and how a tagged version is rolled out, verified, reported and rolled back on the server.

### Modified Capabilities

None.

## Impact

- `deploy/deploy.sh` is rewritten to deploy by tag and gains subcommands.
- `deploy/README.md` documents the release and deploy flow; the deploy section in `README.md` follows.
- `deploy/systemd/spend-tracer-deploy.service` and `deploy/systemd/spend-tracer-deploy.timer` are removed.
- Server migration: disable the timer, then deploy a tag once by hand. The checkout moves to a detached HEAD.
- No application code, API, schema or storage change.

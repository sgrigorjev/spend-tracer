# tag-based-deploy

## 1. Deploy script

- [x] 1.1 Rewrite the argument handling in `deploy/deploy.sh`: require a version argument, accept the flags `--force`, `--status` and `--list`, and reject anything else. Verify `deploy/deploy.sh` with no argument prints usage and exits non-zero, and that an unknown flag does the same.
- [x] 1.2 Add strict version validation and normalization (`^v?[0-9]+\.[0-9]+\.[0-9]+$` to `refs/tags/vX.Y.Z`). Security: the version is untrusted input, so confirm it is rejected before any git call for `1.0`, `latest` and `1.0.0; touch /tmp/pwned`, and that the value is passed quoted, never via `eval`.
- [x] 1.3 Add `flock -n` on a lock file around the deploy body and verify a second invocation started while one is running exits immediately with a clear message instead of rebuilding.
- [x] 1.4 Implement `git fetch --tags --prune origin`, tag resolution, the no-op guard against `.deployed-version`, and `git checkout --force --detach <tag>`. Verify on a throwaway clone that checkout lands on the tagged commit and that an ignored `.env` and a `data/` file are left byte-for-byte unchanged.
- [x] 1.5 Implement `docker compose up -d --build`, `docker image prune -f` and `docker compose ps`, then write `.deployed-version` only after the stack comes up. Verify a successful run updates the state file, and a failing `docker compose up` (stubbed) leaves it unchanged.
- [x] 1.6 Implement `--status` (state file plus `docker compose ps`) and `--list` (`git tag --sort=-v:refname`). Verify `--status` prints the deployed tag and `--list` prints tags newest first.
- [x] 1.7 Add `.deployed-version` to `.gitignore` and verify it is not tracked after a deploy run.
- [x] 1.8 Add a shell test that builds a temporary git repo with a `v1.0.0` tag and a PATH stub for `docker`, then exercises a deploy, a no-op redeploy, a forced redeploy and an unknown version. Verify the test passes and covers the injection-rejection case.

## 2. Remove the automatic deploy

- [x] 2.1 Delete `deploy/systemd/spend-tracer-deploy.timer` and `deploy/systemd/spend-tracer-deploy.service`, and verify no tracked file still references either unit or the 5-minute schedule.
- [x] 2.2 Confirm the stack still comes up after a reboot through the Compose restart policy and note this in the deploy README; verify by reading `docker-compose.yml` that every service keeps `restart: unless-stopped`.

## 3. Release and deploy documentation

- [x] 3.1 Rewrite `deploy/README.md` around the release flow: cut a release by creating and pushing an annotated tag `vX.Y.Z` and publishing it with `gh release create vX.Y.Z --verify-tag --generate-notes`, deploy a version by running `deploy/deploy.sh vX.Y.Z` from the repo root, and roll back by deploying the previous tag. Verify every command in the document matches the implemented CLI exactly.
- [x] 3.2 Replace the deployment section in the root `README.md` with the tag-based flow and remove the timer and pull-`main` instructions. Verify no stale auto-deploy wording remains.

## 4. Server migration

- [x] 4.1 Document the one-time server migration (disable and unlink the timer, `daemon-reload`, cut the first tag, deploy it once) in `deploy/README.md`. Verify the order matches the migration plan in `design.md`.
- [x] 4.2 On the server, run the migration and deploy the first release tag by hand. Verify the checkout is on the tag, `deploy/deploy.sh --status` reports it, and the containers are healthy.

## 5. Review

- [x] 5.1 Run `bash -n deploy/deploy.sh` and the shell test from task 1.8, and verify both pass.
- [x] 5.2 Run the `reviewer` subagent on the change and record every finding with its disposition in `openspec/changes/tag-based-deploy/review.md`. Verify each finding is either fixed or declined with one concrete reason.

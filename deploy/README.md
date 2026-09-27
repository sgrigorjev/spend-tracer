# Deploy

Deployment is a pull-based rollout of one release tag. The server checks out the tag, rebuilds the Docker stack and runs it. The server reaches GitHub; GitHub never connects in, so no deploy key lives in the repo. Nothing deploys on its own: a merge to `main` changes production only when a release is tagged and an operator deploys it.

## Releases

A release is an annotated semver tag `vX.Y.Z` published as a GitHub Release. Create and push the annotated tag first, then let `gh` publish the release for that exact tag:

```sh
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 --verify-tag --generate-notes
```

`--verify-tag` makes `gh` fail if the tag is missing, so the release never creates a lightweight tag of its own. Tags are immutable. Never move, delete or reuse a published tag; ship a fix as a new version.

## Deploy a version

From the server, from the repo root or by full path:

```sh
deploy/deploy.sh v1.0.0                 # deploy a release
~/projects/spend-tracer/deploy/deploy.sh 1.0.0   # the leading v is optional
deploy/deploy.sh --status               # deployed version and container state
deploy/deploy.sh --list                 # recent release tags, newest first
deploy/deploy.sh v1.0.0 --force         # rebuild the version already running
```

The script serializes deploys, switches the checkout to the tag detached, rebuilds and restarts the stack, prunes dangling images, then records the version. `.env` and `data/` are git-ignored and are never touched by the checkout.

Rolling back is deploying an earlier tag: `deploy/deploy.sh v0.9.0`.

Re-run is idempotent: deploying the version that is already running prints `already deployed` and does nothing unless `--force` is passed. The deployed version is recorded in `.deployed-version` (git-ignored) only after the stack comes up.

## Install

One-time setup on the server. Get the code over SSH so the repo can stay private. Add the server's public key on GitHub first, as a deploy key or on an account.

```sh
git clone git@github.com:sgrigorjev/spend-tracer.git ~/projects/spend-tracer
cd ~/projects/spend-tracer
cp .env.example .env
nano .env

sudo usermod -aG docker ubuntu   # re-login if this changed anything
mkdir -p data                    # gitignored, absent on a fresh clone
sudo chown -R 1000:1000 data/    # let the non-root containers write to data/

deploy/deploy.sh v1.0.0
```

The stack keeps `restart: unless-stopped`, so Docker restarts the containers after a reboot. No timer or unit is needed to keep it running.

## Upgrading an install that used the timer

An earlier install deployed `main` automatically every 5 minutes through a systemd timer. Remove it before the first tag deploy, otherwise the timer will pull `main` over the pinned tag:

```sh
sudo systemctl disable --now spend-tracer-deploy.timer
sudo rm -f /etc/systemd/system/spend-tracer-deploy.service /etc/systemd/system/spend-tracer-deploy.timer
sudo systemctl daemon-reload
```

Then deploy a release as above. If the environment file still lives at `bot/.env`, move it to the repo root first (`mv bot/.env .env`).

## Verifying the deploy

```sh
deploy/deploy.sh --status
docker compose logs --tail=50 bot
```

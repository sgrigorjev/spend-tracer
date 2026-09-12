#!/usr/bin/env bash
set -euo pipefail

# Pull the latest main and redeploy the Docker stack. Run by a systemd timer;
# pass --force to rebuild even when the checkout already matches origin.
REPO_DIR="${REPO_DIR:-/home/ubuntu/spend-tracer}"
cd "$REPO_DIR"

force=false
if [ "${1:-}" = "--force" ]; then
  force=true
fi

git fetch --prune origin

local_rev="$(git rev-parse HEAD)"
remote_rev="$(git rev-parse '@{u}')"

if [ "$local_rev" = "$remote_rev" ] && [ "$force" = false ]; then
  exit 0
fi

echo "Deploying $remote_rev (was $local_rev)"
git pull --ff-only
docker compose up -d --build
docker image prune -f
docker compose ps

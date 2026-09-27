#!/usr/bin/env bash
set -euo pipefail

# Deploy one release tag to the Docker stack. Run by hand on the server:
#
#   deploy/deploy.sh v1.0.0     # deploy a release
#   deploy/deploy.sh --status   # show what is deployed and the container state
#   deploy/deploy.sh --list     # list recent release tags
#
# A second deploy while one is running exits immediately. Pass --force to
# redeploy the version that is already running. Nothing deploys automatically.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
cd "$REPO_DIR"

STATE_FILE=".deployed-version"
LOCK_FILE=".deploy.lock"

usage() {
  echo "usage: deploy.sh <version> [--force] | --status | --list" >&2
  exit 2
}

force=false
list=false
status=false
version=""

for arg in "$@"; do
  case "$arg" in
    --force) force=true ;;
    --list) list=true ;;
    --status) status=true ;;
    -*) usage ;;
    *)
      if [ -n "$version" ]; then usage; fi
      version="$arg"
      ;;
  esac
done

if [ "$list" = true ] && [ "$status" = true ]; then usage; fi

# --status and --list are read-only and never take a version or --force.
if [ "$list" = true ] || [ "$status" = true ]; then
  if [ -n "$version" ] || [ "$force" = true ]; then usage; fi
fi

# Fetch over SSH. accept-new admits GitHub's host key on the first run and
# verifies it after, so a non-interactive run does not hang on a prompt.
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new"

if [ "$list" = true ]; then
  git fetch --prune --prune-tags --tags origin
  # Only exact release tags, so prereleases like v1.0.0-rc.1 stay out.
  git tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' || true
  exit 0
fi

if [ "$status" = true ]; then
  if [ -f "$STATE_FILE" ]; then
    echo "deployed version: $(cat "$STATE_FILE")"
  else
    echo "deployed version: (unknown)"
  fi
  if checked_out="$(git describe --tags --exact-match 2>/dev/null)"; then
    echo "checkout: $checked_out"
  else
    echo "checkout: (not on a tag)"
  fi
  docker compose ps || true
  exit 0
fi

if [ -z "$version" ]; then usage; fi

# The version is the only untrusted input. Validate it strictly and never pass
# it through eval, so a crafted argument cannot become a shell command.
if [[ ! "$version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: '$version' is not a version (expected X.Y.Z or vX.Y.Z)" >&2
  exit 2
fi
tag="v${version#v}"

# Serialize deploys. Hold the lock for the whole run; a second invocation fails
# fast instead of queueing a second checkout and rebuild.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "error: another deploy is already running" >&2
  exit 1
fi

# A deploy is a no-op only when a successful deploy is on record and the
# checkout still matches it. A missing state file means no deploy succeeded yet,
# so retry; a drifted checkout falls through and is restored to the tag.
current=""
if [ -f "$STATE_FILE" ]; then
  current="$(cat "$STATE_FILE")"
fi

if [ "$force" = false ] && [ "$current" = "$tag" ]; then
  if [ "$(git describe --tags --exact-match 2>/dev/null || true)" = "$tag" ]; then
    echo "already deployed: $tag (use --force to rebuild)"
    exit 0
  fi
fi

git fetch --prune --prune-tags --tags origin

if ! git rev-parse --verify --quiet "refs/tags/$tag" >/dev/null; then
  echo "error: tag '$tag' not found. Run 'deploy/deploy.sh --list' to see available releases." >&2
  exit 1
fi

echo "Deploying $tag (was ${current:-(unknown)})"
git -c advice.detachedHead=false checkout --force --detach "refs/tags/$tag"

# --wait blocks until every service is running, so a container that fails to
# start aborts here and the version is not recorded as deployed.
docker compose up -d --build --wait --wait-timeout 120 --remove-orphans

# Record the version only after the stack came up, so the file always reflects
# what is actually running. Pruning and status are best-effort from here.
printf '%s\n' "$tag" > "$STATE_FILE"
docker image prune -f || true
docker compose ps || true
echo "Deployed $tag"

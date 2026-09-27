#!/usr/bin/env bash
# Exercise deploy/deploy.sh against a throwaway git repo and a stubbed docker.
# Run directly: deploy/test/deploy.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/deploy/deploy.sh"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "ok - $*"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# -- stub docker ----------------------------------------------------------
mkdir -p "$WORK/bin"
cat > "$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "${DOCKER_LOG:?}"
if [ "${DOCKER_FAIL:-0}" = "1" ] && [ "${1:-}" = "compose" ] && [ "${2:-}" = "up" ]; then
  exit 1
fi
exit 0
STUB
chmod +x "$WORK/bin/docker"
export PATH="$WORK/bin:$PATH"
export DOCKER_LOG="$WORK/docker.log"
: > "$DOCKER_LOG"

# -- source repo with two release tags ------------------------------------
git init -q --bare "$WORK/remote.git"
git -C "$WORK/remote.git" symbolic-ref HEAD refs/heads/main
git init -q -b main "$WORK/src"
git -C "$WORK/src" config user.email test@example.com
git -C "$WORK/src" config user.name test
git -C "$WORK/src" config commit.gpgsign false
printf 'data/\n.env\n.deployed-version\n.deploy.lock\n' > "$WORK/src/.gitignore"
echo "app v1" > "$WORK/src/app.txt"
git -C "$WORK/src" add -A
git -C "$WORK/src" commit -qm "v1"
git -C "$WORK/src" tag -a v1.0.0 -m "v1.0.0"
echo "app v2" > "$WORK/src/app.txt"
git -C "$WORK/src" commit -qam "v2"
git -C "$WORK/src" tag -a v1.1.0 -m "v1.1.0"
git -C "$WORK/src" remote add origin "$WORK/remote.git"
git -C "$WORK/src" push -q origin main v1.0.0 v1.1.0

git clone -q "$WORK/remote.git" "$WORK/checkout"

# runtime files a deploy must never touch
echo "SECRET=1" > "$WORK/checkout/.env"
mkdir -p "$WORK/checkout/data"
echo "db" > "$WORK/checkout/data/spend-tracer.db"

deploy() { REPO_DIR="$WORK/checkout" "$SCRIPT" "$@"; }

# -- deploy a version -----------------------------------------------------
out="$(deploy 1.0.0)"
grep -q "Deployed v1.0.0" <<<"$out" || fail "deploy did not report the version"
[ "$(cat "$WORK/checkout/.deployed-version")" = "v1.0.0" ] || fail "state file not written"
[ "$(git -C "$WORK/checkout" describe --tags --exact-match)" = "v1.0.0" ] || fail "checkout is not on the tag"
[ "$(cat "$WORK/checkout/.env")" = "SECRET=1" ] || fail ".env was modified"
[ "$(cat "$WORK/checkout/data/spend-tracer.db")" = "db" ] || fail "data file was modified"
grep -q "compose up -d --build" "$DOCKER_LOG" || fail "compose up was not called"
pass "deploys a tagged version and preserves .env and data/"

# -- status reflects the deployed version ---------------------------------
out="$(deploy --status)"
grep -q "deployed version: v1.0.0" <<<"$out" || fail "--status did not report the deployed version"
grep -q "checkout: v1.0.0" <<<"$out" || fail "--status did not report the checkout"
pass "--status reports the deployed version"

# -- same version is a no-op ----------------------------------------------
before="$(wc -l < "$DOCKER_LOG")"
out="$(deploy v1.0.0)"
grep -q "already deployed" <<<"$out" || fail "no-op guard did not trigger"
[ "$(wc -l < "$DOCKER_LOG")" = "$before" ] || fail "no-op deploy still ran docker"
pass "redeploying the same version is a no-op"

# -- force redeploys ------------------------------------------------------
deploy v1.0.0 --force >/dev/null
[ "$(wc -l < "$DOCKER_LOG")" -gt "$before" ] || fail "force deploy did not run docker"
pass "--force rebuilds the current version"

# -- unknown version ------------------------------------------------------
if deploy v9.9.9 >/dev/null 2>&1; then fail "unknown version unexpectedly succeeded"; fi
[ "$(cat "$WORK/checkout/.deployed-version")" = "v1.0.0" ] || fail "failed deploy changed the state file"
pass "an unknown version fails without changing state"

# -- injection is rejected ------------------------------------------------
if deploy "v1.0.0; touch $WORK/pwned" >/dev/null 2>&1; then fail "injection unexpectedly succeeded"; fi
[ ! -e "$WORK/pwned" ] || fail "injection executed a command"
pass "a crafted version argument is rejected"

# -- a second deploy cannot interleave ------------------------------------
flock -n "$WORK/checkout/.deploy.lock" -c 'sleep 5' &
holder=$!
sleep 0.5
if deploy v1.0.0 --force >/dev/null 2>&1; then fail "deploy ran while the lock was held"; fi
kill "$holder" 2>/dev/null || true
wait "$holder" 2>/dev/null || true
pass "a concurrent deploy is refused"

# -- failed stack build keeps the old state -------------------------------
rm -f "$WORK/checkout/.deployed-version"
if DOCKER_FAIL=1 deploy v1.0.0 --force >/dev/null 2>&1; then fail "failed compose up unexpectedly succeeded"; fi
[ ! -e "$WORK/checkout/.deployed-version" ] || fail "state written after a failed stack build"
pass "a failed stack build does not record a version"

# -- list orders releases newest first ------------------------------------
first="$(deploy --list | head -n1)"
[ "$first" = "v1.1.0" ] || fail "--list is not newest-first (got '$first')"
pass "--list orders releases newest first"

# -- read-only flags reject extra arguments -------------------------------
if deploy --status v1.0.0 >/dev/null 2>&1; then fail "--status accepted a version argument"; fi
if deploy --list --force >/dev/null 2>&1; then fail "--list accepted --force"; fi
if deploy >/dev/null 2>&1; then fail "deploy accepted no version"; fi
pass "read-only flags and missing version are rejected"

# -- runtime state is git-ignored -----------------------------------------
for f in .deployed-version .deploy.lock; do
  git -C "$WORK/checkout" check-ignore -q "$f" || fail "$f is not git-ignored"
done
pass "deployment state is git-ignored"

echo "all deploy tests passed"

## Why

Nothing static-analyzes the code on pull requests. gitleaks only catches committed secrets; semgrep adds rule-based checks for security and correctness across the TypeScript, Node, React, Docker and nginx files the repo already ships.

## What Changes

- Add `.github/workflows/semgrep.yml`: run Semgrep CE on every pull request and on manual dispatch, using the official `semgrep/semgrep` container and a curated set of registry rulesets.
- Fail the job on any finding (`--error`), so a red check can gate the merge once branch protection requires it.
- Remove `proxy_set_header Host $host;` from `web/nginx.conf`: the API does not read the Host header, so forwarding the client-controlled value is an avoidable risk. This is the pre-existing finding that blocked the first scan.

## Capabilities

None. This is CI tooling plus one nginx proxy tweak with no product behavior, so the change declares `skip_specs: true`.

## Impact

- `.github/workflows/semgrep.yml`, `web/nginx.conf`.
- No product code, API or spec change.
- The gate only bites with a branch protection rule on `main` that requires the semgrep check.

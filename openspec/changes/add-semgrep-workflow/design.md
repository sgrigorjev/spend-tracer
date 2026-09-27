# Design — add-semgrep-workflow

## Decisions

**Semgrep CE, not the archived action.** `returntocorp/semgrep-action@v1` was archived in April 2024. The current Semgrep CE pattern runs the `semgrep/semgrep` container and the `semgrep scan` CLI, which needs no `SEMGREP_APP_TOKEN` and no Semgrep platform account. Security-wise there is no secret to leak and no third-party action to trust between checkout and scan.

**Container image pinned by digest.** `semgrep/semgrep@sha256:32e4...` is `1.178.0`, so a later image cannot silently change what runs. This matches the SHA pinning already used in `secret-scan.yml`.

**Job-level container with a plain checkout.** The job runs inside `semgrep/semgrep`, so `semgrep scan` needs no install step. `actions/checkout` runs in that same container and is pinned by SHA.

**Ruleset set.** `p/security-audit` and `p/owasp-top-ten` cover security; `p/typescript`, `p/nodejs`, `p/react`, `p/dockerfile`, `p/nginx` match the languages and files the repo ships; `p/secrets` complements gitleaks. `p/typescript` and `p/javascript` are the same registry pack, so only one is listed.

**Fail on findings.** `semgrep scan` exits 0 even with findings; `--error` makes it exit 1. Without that the job is green whatever it finds and cannot gate anything.

**No SARIF upload.** Code Scanning needs GitHub Advanced Security, which a private repo does not have by default, so `github/codeql-action/upload-sarif` would fail on every run. Findings print to the job log. If GHAS is enabled later, add `--sarif --output semgrep.sarif`, the `upload-sarif` step, and `security-events: write` to permissions.

**Triggers.** `pull_request` plus `workflow_dispatch` for manual runs. No `push` to main, since the PR run already covers the change. No schedule, since a nightly run nobody opens is noise.

**Trim the forwarded Host header.** The first scan flagged `proxy_set_header Host $host;` in `web/nginx.conf` as a blocking finding (`generic.nginx.security.request-host-used`). The API verifies the Google ID token server-side and builds no URL from the Host header, so forwarding the client-controlled value buys nothing. Removing the line lets nginx send its default `$proxy_host` (`api:3000`) and clears the finding without suppressing the rule.

## Risks

- `p/owasp-top-ten` is about 1.4 MB of rules and `p/security-audit` is large too, so the first scan can be slow and can flag pre-existing code. Because `--error` fails on any finding, the check may be red before any new code. If that proves noisy, add `--severity ERROR` so only high-severity findings fail.
- The check only blocks a merge once `main` has a branch protection rule requiring it.

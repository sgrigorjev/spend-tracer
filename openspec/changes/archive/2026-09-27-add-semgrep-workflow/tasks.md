## 1. Workflow

- [x] 1.1 Add `.github/workflows/semgrep.yml`: Semgrep CE on `pull_request` and `workflow_dispatch`, running the `semgrep/semgrep` container.
- [x] 1.2 Use the registry rulesets that match the stack: `p/security-audit`, `p/owasp-top-ten`, `p/typescript`, `p/nodejs`, `p/react`, `p/dockerfile`, `p/nginx`, `p/secrets`.
- [x] 1.3 Fail on findings with `--error`; pin `actions/checkout` by SHA to match `secret-scan.yml`.

## 2. nginx Host header

- [x] 2.1 Remove `proxy_set_header Host $host;` from `web/nginx.conf`, the pre-existing blocking finding.

## 3. Verification

- [x] 3.1 Confirmed on PR #48: the check ran and went red on a finding (the pre-existing Host header), then green after the fix.
- [x] 3.2 Confirmed: 0 findings with the pinned image locally, and a green `static analysis` check in CI.

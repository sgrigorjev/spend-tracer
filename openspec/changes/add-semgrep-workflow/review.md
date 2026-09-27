# Review — add-semgrep-workflow

Independent pass by the `reviewer` subagent (`deepseek/deepseek-v4-pro`), read-only, against `origin/main`. Recorded per the AGENTS.md code-review rule: every finding carries a disposition.

| # | Severity | Location | Finding | Disposition |
|---|----------|----------|---------|-------------|
| 1 | minor | `.github/workflows/semgrep.yml:18` | The dependabot `if` silently excluded dependabot PRs while the proposal claimed every PR is scanned. That skip exists to dodge the `SEMGREP_APP_TOKEN` permission issue, which does not apply here. | applied: dropped the `if`, so all PRs are scanned. |
| 2 | minor | `.github/workflows/semgrep.yml:20` | The container image floated on `latest`, unlike the SHA-pinned actions in `secret-scan.yml`. | applied: pinned to `semgrep/semgrep@sha256:32e459968daabe7ab86968184a29109b9564aa00392401156f9788452b42786b` (`1.178.0`). |
| 3 | minor | `openspec/changes/add-semgrep-workflow/` | No `design.md`, though the prior CI changes shipped one and `openspec/config.yaml` carries a security-focused design rule. | applied: added `design.md` recording the container, ruleset, `--error`, SARIF and trigger decisions with their risks. |
| 4 | nit | `.github/workflows/semgrep.yml:16` | `semgrep-oss/scan` renders in the checks list as `semgrep / semgrep-oss/scan`. | applied: renamed the job to `static analysis`. |

Verdict: no blocker or major finding; all four applied. The reviewer also confirmed `--error` semantics, that all eight `p/` rulesets resolve, that `--metrics=off` is current, and that the container plus checkout pattern is the canonical one.

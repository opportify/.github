# .github

Public, org-wide GitHub defaults and reusable workflows for Opportify.
Public repos (the SDKs) use these because they cannot call workflows in our private `opportify/github-actions` repo.

## Policy

Workflows may only use actions built by us (`opportify/*`) or by GitHub (`actions/*`, `github/*`).
No third-party actions and no `docker://` images. `allowed-actions.yml` enforces this in CI.

## Reusable workflows and actions

| Path | What it does |
|---|---|
| `.github/workflows/release-drafter.yml` | Drafts the next release (own script, no third-party action) |
| `.github/workflows/labeler.yml` | Labels PRs by branch name |
| `.github/workflows/allowed-actions.yml` | Fails on any action outside the policy |
| `.github/actions/setup-php` | Installs PHP and Composer (replaces `shivammathur/setup-php`) |

Callers need no secrets: do not use `secrets: inherit`.

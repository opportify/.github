# .github

Public, org-wide GitHub defaults and reusable workflows for Opportify.
Our public repos (the SDKs) use the reusable workflows and actions here.

## Policy

Workflows may only use actions built by us (`opportify/*`) or by GitHub (`actions/*`, `github/*`).
No third-party actions and no `docker://` images. `allowed-actions.yml` enforces this in CI.

## Reusable workflows and actions

| Path | What it does |
|---|---|
| `.github/workflows/release-drafter.yml` | Drafts the next release (own script, no third-party action) |
| `.github/workflows/labeler.yml` | Labels PRs by branch name |
| `.github/workflows/allowed-actions.yml` | Fails on any action outside the policy |
| `.github/actions/setup-php` | Installs PHP and Composer (replaces `shivammathur/setup-php`). Versions not preinstalled come from packages.sury.org; list the extensions you need in `extensions`. |

Callers need no secrets: do not use `secrets: inherit`.

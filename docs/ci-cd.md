# CI/CD and releases

THE BRIDGE uses GitHub Actions to keep `develop` integration-ready and `main`
release-ready. Workflows use Node.js 24, the pnpm version declared in
`package.json`, immutable action commit SHAs, and the smallest practical token
permissions.

## Workflows

### CI

`.github/workflows/ci.yml` runs on pull requests into `develop` or `main`, on
pushes to those branches, and on manual dispatch. New commits cancel obsolete
runs for the same pull request or branch.

The workflow runs these jobs in parallel:

- `Quality`: formatting, lint, and TypeScript checks;
- `API tests (sqlite)`: unit tests, coverage, and the global coverage gate;
- `API tests (postgres)`: the same API suite with the PostgreSQL migration test;
- `API end-to-end`: HTTP-level NestJS tests with isolated local dependencies;
- `Build`: production builds for every workspace.

`Required checks` is the stable aggregate check intended for branch rules. It
fails if any required CI job fails, is canceled, or is skipped.

### Security

`.github/workflows/security.yml` runs on the same pull requests and branches,
on manual dispatch, and every Monday. It contains:

- `Dependency audit`, which fails for high or critical pnpm advisories;
- `Secret scan`, which scans the complete Git history with Gitleaks;
- `Security checks`, the stable aggregate check for branch rules.

The repository belongs to a personal account, so Gitleaks does not require a
license secret. If the repository moves to an organization, add
`GITLEAKS_LICENSE` as an Actions secret before the next run.

GitHub CodeQL, dependency review, native secret scanning, and push protection
should be enabled when the repository becomes public, where GitHub provides
them without a paid Code Security or Secret Protection license. The current
private, user-owned repository is not eligible for those native scans.

Dependabot checks npm workspace dependencies and GitHub Actions every Monday.

The coverage threshold starts at 45% for statements, functions, and lines, and
35% for branches. These values sit below the current baseline so the workflow
prevents regressions without failing on day one. Treat them as floors, not
targets: new code should improve meaningful coverage and the thresholds should
rise with it.

## Branch rules

Create repository rulesets for both `develop` and `main` with these settings:

- block branch deletion and force pushes;
- require a pull request before merging;
- require all review conversations to be resolved;
- require the branch to be up to date before merging;
- require `Required checks` and `Security checks` from GitHub Actions;
- do not allow bypasses except an explicit emergency maintainer bypass;
- require one approval when a second maintainer is available.

For `main`, accept changes only from a `release/*` or `hotfix/*` pull request in
normal operation. Direct pushes remain reserved for a documented emergency.

GitHub only exposes a check as a ruleset option after it has run at least once.
Create or update the rulesets after the first successful run of both workflows.

## Release process

1. Stabilize the version in `release/<version>` and merge it into `main`.
2. Confirm that `Required checks` and `Security checks` pass on `main`.
3. Create an annotated semantic-version tag on the exact `main` commit.
4. Push the tag.

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.0.0 -m "THE BRIDGE v1.0.0"
git push origin v1.0.0
```

`.github/workflows/release.yml` rejects malformed tags and tags whose commit is
not contained in `main`. It then repeats formatting, lint, type checks, SQLite
and PostgreSQL tests, end-to-end tests, and production builds before creating a
GitHub release with generated notes.

The core workflows require no application credentials or provider tokens.
Never add local `.env` values, GitHub/GitLab access tokens, database snapshots,
or operating-system credential-store values to Actions secrets or artifacts.

# Contributing to THE BRIDGE

Thank you for helping improve THE BRIDGE. This project is preparing for an open
source release and values focused changes, explicit intent, and safe handling of
local data.

## Repository language

Use English for branch names, commits, code, comments, documentation, issues,
pull requests, reviews, and tests. User-facing copy may be localized.

Use descriptive names. Avoid unexplained abbreviations and comments that merely
repeat the code. Comments should explain constraints, intent, or non-obvious
trade-offs.

## GitFlow

1. Start feature work from `develop`.
2. Create a focused branch such as `feature/project-path-validation`.
3. Rebase or merge the latest `develop` before requesting review.
4. Open a pull request into `develop`.
5. Use `release/<version>` for release stabilization.
6. Use `hotfix/<short-name>` only for urgent production fixes from `main`.

Direct feature commits to `main` and `develop` are discouraged. `main` must stay
release-ready.

## Conventional Commits

Use this format:

```text
<type>(<scope>): <short imperative description>
```

Allowed types:

- `feat`: a new user-facing capability;
- `fix`: a defect correction;
- `docs`: documentation only;
- `style`: formatting without behavior changes;
- `refactor`: code restructuring without feature or bug changes;
- `perf`: a performance improvement;
- `test`: tests only;
- `build`: build system or dependency changes;
- `ci`: continuous-integration changes;
- `chore`: repository maintenance;
- `revert`: a reverted change.

Use a concise domain or workspace as the scope, for example `projects`,
`clients`, `activity`, `integrations`, `web`, `api`, or `repo`.

Breaking changes must add `!` after the type or scope and explain the migration
in the commit body.

## Before opening a pull request

Run the complete local verification suite:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter api test:e2e --runInBand
pnpm build
```

Also verify that:

- no secret, token, database, build output, or local path was committed;
- new behavior is covered by tests proportional to its risk;
- documentation reflects changed setup or behavior;
- the pull request contains one coherent concern;
- accessibility and both light and dark themes were checked for UI changes.

## Pull request description

Explain:

- what changed;
- why the change is needed;
- how it was verified;
- any security, data-migration, or compatibility impact.

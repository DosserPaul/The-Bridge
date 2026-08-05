<p align="center">
  <img src="apps/web/public/brand/the-bridge-mark.svg" width="72" alt="THE BRIDGE logo" />
</p>

<h1 align="center">THE BRIDGE</h1>

<p align="center"><em>See everything. Direct anything.</em></p>

<p align="center">
  A local-first mission control for freelance work, client context, projects,
  repositories, provider integrations, and auditable actions.
</p>

> [!IMPORTANT]
> THE BRIDGE is under active development. Interfaces, storage formats, and APIs
> may change before the first stable release.

## Why THE BRIDGE?

Freelance work is usually spread across repositories, provider dashboards,
client notes, deadlines, and local folders. THE BRIDGE brings that operational
context into one private cockpit without moving local source code or provider
credentials into a hosted service.

## Current features

- Manage organizations, individuals, contacts, and client branding.
- Create personal or client projects with status, priority, dates, and tags.
- Edit and archive projects without deleting their history.
- Attach multiple repositories and remove associations without deleting code.
- Bind each repository to an explicit GitHub or GitLab connection.
- Attach an existing local Git repository.
- Clone an existing GitHub or GitLab repository.
- Create a remote repository and clone it locally.
- Validate and normalize local paths before project creation.
- Read repository branch, head commit, remote, and working-tree state.
- Connect GitHub, GitLab.com, or a self-hosted GitLab instance.
- Display recent GitHub Actions and GitLab pipelines through a shared CI/CD view.
- Record application actions in a categorized, searchable activity log.
- Create local backups, download portable exports, and restore data safely.
- Store provider credentials in the operating-system credential store.

## Architecture

```text
apps/
├── web/    Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
└── api/    NestJS 11, SQLite/PostgreSQL, Git and provider integrations
```

The web application runs on `http://127.0.0.1:3100`. The API runs on
`http://127.0.0.1:3101/api`. Both services bind to the loopback interface by
default because the API can inspect local repositories.

## Requirements

- Node.js 24 or newer
- pnpm 11.10 or newer
- Git
- An operating-system credential store supported by `@napi-rs/keyring`
- Docker (optional, only when using PostgreSQL locally)

## Getting started

```bash
git clone https://github.com/DosserPaul/The-Bridge.git
cd The-Bridge
pnpm install
pnpm dev
```

Then open [http://127.0.0.1:3100](http://127.0.0.1:3100).

Environment files are optional for the default local setup. When overrides are
needed, copy the examples first:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Never commit real environment files, access tokens, SQLite databases, or local
credential-store data.

## Development commands

| Command                                  | Purpose                                       |
| ---------------------------------------- | --------------------------------------------- |
| `pnpm dev`                               | Run the web application and API in watch mode |
| `pnpm dev:web`                           | Run only Next.js                              |
| `pnpm dev:api`                           | Run only NestJS                               |
| `pnpm db:postgres:start`                 | Start the optional PostgreSQL container       |
| `pnpm db:postgres:stop`                  | Stop the optional PostgreSQL container        |
| `pnpm lint`                              | Lint all workspaces                           |
| `pnpm typecheck`                         | Type-check all workspaces                     |
| `pnpm test`                              | Run API unit tests                            |
| `pnpm --filter api test:e2e --runInBand` | Run API end-to-end tests                      |
| `pnpm build`                             | Build every workspace                         |

## Provider connections

Open **Settings → Integrations** to connect a provider.

- GitHub repository listing requires metadata read access. Repository creation
  requires administration write access for a fine-grained token. Private
  repository workflow runs require repository access and Actions read access.
- GitLab repository listing and pipeline access require `read_api`. Remote
  project creation requires `api`.
- Clone credentials are provided to Git only for the duration of the command.
  They are never embedded in remote URLs or activity payloads.

Public account metadata and credential references are stored in SQLite. Secret
values remain in the operating-system credential store.

## Database and local data

SQLite is the default and requires no external service. Runtime data is stored
under `.data/`, which is ignored by Git. The default database path is
`.data/claudehub.sqlite`; it can be overridden with
`CLAUDEHUB_DATABASE_PATH`. Versioned migrations run automatically at API
startup and preserve existing data.

PostgreSQL is optional. Start the provided PostgreSQL 18 container and enable
it through the API environment file:

```bash
pnpm db:postgres:start
cp apps/api/.env.example apps/api/.env
```

Then uncomment `DATABASE_URL` in `apps/api/.env`. Stop the container with
`pnpm db:postgres:stop`. Switching database engines does not implicitly copy
data; use **Settings → Data** to export from one engine and restore into the
other.

The Data settings page can:

- create private JSON snapshots under `.data/backups/`;
- download a portable JSON export;
- restore either form transactionally;
- create a safety snapshot automatically before every restore.

Provider tokens are never included. They remain in the operating-system
credential store, so restored connections may require their token to be added
again on another machine.

The legacy `claudehub` storage identifiers are intentionally retained for local
data and credential compatibility while the product branding is migrated to
THE BRIDGE.

## API overview

The local API currently exposes the following resource groups:

- `/api/health`
- `/api/clients`
- `/api/projects`
- `/api/projects/validate-repository-path`
- `/api/projects/:projectId/pipelines`
- `/api/projects/:projectId/repositories`
- `/api/data/status`
- `/api/data/backups`
- `/api/data/export`
- `/api/data/restore`
- `/api/activity`
- `/api/integrations/github`
- `/api/integrations/gitlab`

## Git workflow

THE BRIDGE uses [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/):

- `main` contains production-ready code and release tags.
- `develop` is the integration branch for the next release.
- `feature/<short-name>` branches start from `develop` and merge back into it.
- `release/<version>` branches prepare a release and merge into both `main` and
  `develop`.
- `hotfix/<short-name>` branches start from `main` and merge into both `main`
  and `develop`.

Do not commit feature work directly to `main` or `develop`. Open a pull request
and keep it focused on one concern.

## Commit convention

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short imperative description>
```

Supported types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, and `revert`.

Examples:

```text
feat(projects): validate clone destinations
fix(activity): redact provider credentials
docs(contributing): document the GitFlow process
chore(repo): update workspace dependencies
```

## Language policy

The repository language is English. The following must always be written in
English:

- commit messages and branch names;
- code comments and documentation;
- variables, functions, classes, types, files, and test descriptions;
- issues, pull requests, review comments, and release notes.

User-facing copy may be localized. French interface strings are therefore
allowed, but implementation terminology remains English.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

Do not report credential leaks or security vulnerabilities in a public issue.
Until a dedicated security policy and private reporting channel are published,
contact the maintainer directly through GitHub.

## License

THE BRIDGE is available under the [MIT License](LICENSE).

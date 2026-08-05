# THE BRIDGE API

The local NestJS API for clients, projects, repositories, provider integrations,
pipelines, credentials, and the activity log.

Run it from the repository root:

```bash
pnpm dev:api
```

The API is available at `http://127.0.0.1:3101/api`. Copy `.env.example` to
`.env` to override the allowed web origin, bind host, or database path.

See the [root README](../../README.md) for setup, architecture, security,
GitFlow, and commit conventions.

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';

function findWorkspaceRoot(startDirectory: string): string {
  let currentDirectory = resolve(startDirectory);
  const filesystemRoot = parse(currentDirectory).root;

  while (currentDirectory !== filesystemRoot) {
    if (existsSync(resolve(currentDirectory, 'pnpm-workspace.yaml'))) {
      return currentDirectory;
    }

    currentDirectory = dirname(currentDirectory);
  }

  return resolve(startDirectory);
}

function defaultDatabasePath(): string {
  return resolve(findWorkspaceRoot(process.cwd()), '.data', 'claudehub.sqlite');
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly connection: Database.Database;

  constructor(
    databasePath = process.env.CLAUDEHUB_DATABASE_PATH ?? defaultDatabasePath(),
  ) {
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.connection = new Database(databasePath);
    this.connection.pragma('foreign_keys = ON');
    this.connection.pragma('busy_timeout = 5000');

    if (databasePath !== ':memory:') {
      this.connection.pragma('journal_mode = WAL');
    }

    this.migrate();
  }

  onModuleDestroy(): void {
    this.connection.close();
  }

  private migrate(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        name TEXT NOT NULL COLLATE NOCASE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        local_path TEXT NOT NULL UNIQUE,
        remote_url TEXT,
        provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'unknown')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provider_connections (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
        base_url TEXT NOT NULL,
        credential_account TEXT NOT NULL UNIQUE,
        account_id TEXT NOT NULL,
        account_username TEXT NOT NULL,
        account_name TEXT NOT NULL,
        account_avatar_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (provider, base_url)
      );

      CREATE TABLE IF NOT EXISTS client_contacts (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT,
        email TEXT,
        phone TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        category TEXT NOT NULL CHECK (
          category IN (
            'clients', 'projects', 'repositories', 'integrations',
            'security', 'system'
          )
        ),
        action TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('success', 'error')),
        method TEXT NOT NULL,
        route TEXT NOT NULL,
        subject_type TEXT,
        subject_id TEXT,
        summary TEXT NOT NULL,
        request_json TEXT,
        response_json TEXT,
        error_json TEXT,
        http_status INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS projects_client_id_idx
        ON projects(client_id);

      CREATE INDEX IF NOT EXISTS repositories_project_id_idx
        ON repositories(project_id);

      CREATE INDEX IF NOT EXISTS provider_connections_provider_idx
        ON provider_connections(provider);

      CREATE INDEX IF NOT EXISTS client_contacts_client_id_idx
        ON client_contacts(client_id);

      CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx
        ON activity_logs(created_at DESC);

      CREATE INDEX IF NOT EXISTS activity_logs_category_created_at_idx
        ON activity_logs(category, created_at DESC);

      CREATE INDEX IF NOT EXISTS activity_logs_status_created_at_idx
        ON activity_logs(status, created_at DESC);
    `);

    this.ensureProviderConnectionSupportsGitHub();
    this.ensureClientColumn('kind', "TEXT NOT NULL DEFAULT 'organization'");
    this.ensureClientColumn('status', "TEXT NOT NULL DEFAULT 'active'");
    this.ensureClientColumn('email', 'TEXT');
    this.ensureClientColumn('phone', 'TEXT');
    this.ensureClientColumn('website', 'TEXT');
    this.ensureClientColumn('notes', 'TEXT');
    this.ensureClientColumn('logo_data_url', 'TEXT');
    this.ensureProjectColumn('logo_data_url', 'TEXT');
    this.ensureProjectColumn('description', 'TEXT');
    this.ensureProjectColumn('status', "TEXT NOT NULL DEFAULT 'active'");
    this.ensureProjectColumn('priority', "TEXT NOT NULL DEFAULT 'normal'");
    this.ensureProjectColumn('types_json', "TEXT NOT NULL DEFAULT '[]'");
    this.ensureProjectColumn('technologies_json', "TEXT NOT NULL DEFAULT '[]'");
    this.ensureProjectColumn('start_date', 'TEXT');
    this.ensureProjectColumn('deadline', 'TEXT');
    this.ensureProjectColumn('follow_up_date', 'TEXT');
    this.ensureProjectColumn('follow_up_note', 'TEXT');
  }

  private ensureProviderConnectionSupportsGitHub(): void {
    const table = this.connection
      .prepare(
        `SELECT sql
         FROM sqlite_master
         WHERE type = 'table' AND name = 'provider_connections'`,
      )
      .get() as { sql: string } | undefined;

    if (table?.sql.includes("'github'")) return;

    this.connection.transaction(() => {
      this.connection.exec(`
        CREATE TABLE provider_connections_next (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
          base_url TEXT NOT NULL,
          credential_account TEXT NOT NULL UNIQUE,
          account_id TEXT NOT NULL,
          account_username TEXT NOT NULL,
          account_name TEXT NOT NULL,
          account_avatar_url TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (provider, base_url)
        );

        INSERT INTO provider_connections_next (
          id, provider, base_url, credential_account, account_id,
          account_username, account_name, account_avatar_url,
          created_at, updated_at
        )
        SELECT
          id, provider, base_url, credential_account, account_id,
          account_username, account_name, account_avatar_url,
          created_at, updated_at
        FROM provider_connections;

        DROP TABLE provider_connections;
        ALTER TABLE provider_connections_next RENAME TO provider_connections;

        CREATE INDEX provider_connections_provider_idx
          ON provider_connections(provider);
      `);
    })();
  }

  private ensureClientColumn(columnName: string, definition: string): void {
    const columns = this.connection
      .prepare('PRAGMA table_info(clients)')
      .all() as {
      name: string;
    }[];

    if (columns.some((column) => column.name === columnName)) return;

    this.connection.exec(
      `ALTER TABLE clients ADD COLUMN ${columnName} ${definition}`,
    );
  }

  private ensureProjectColumn(columnName: string, definition: string): void {
    const columns = this.connection
      .prepare('PRAGMA table_info(projects)')
      .all() as { name: string }[];

    if (columns.some((column) => column.name === columnName)) return;

    this.connection.exec(
      `ALTER TABLE projects ADD COLUMN ${columnName} ${definition}`,
    );
  }
}

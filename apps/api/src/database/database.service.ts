import { existsSync, mkdirSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { knex, type Knex } from 'knex';
import { migrationSource } from './migrations';

export type DatabaseDialect = 'sqlite' | 'postgres';

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

function isPostgresUrl(target: string): boolean {
  return /^postgres(?:ql)?:\/\//i.test(target);
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly connection: Knex;
  readonly dialect: DatabaseDialect;
  readonly sqlitePath: string | null;

  private initialization: Promise<void> | null = null;

  constructor(
    target = process.env.DATABASE_URL ??
      process.env.CLAUDEHUB_DATABASE_PATH ??
      defaultDatabasePath(),
  ) {
    if (isPostgresUrl(target)) {
      this.dialect = 'postgres';
      this.sqlitePath = null;
      this.connection = knex({
        client: 'pg',
        connection: target,
        pool: { min: 0, max: 10 },
      });
      return;
    }

    const databasePath = target.startsWith('sqlite:')
      ? target.slice('sqlite:'.length)
      : target;
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.dialect = 'sqlite';
    this.sqlitePath = databasePath;
    this.connection = knex({
      client: 'better-sqlite3',
      connection: { filename: databasePath },
      useNullAsDefault: true,
      pool: { min: 1, max: 1 },
    });
  }

  onModuleInit(): Promise<void> {
    return this.initialize();
  }

  initialize(): Promise<void> {
    this.initialization ??= this.initializeConnection();
    return this.initialization;
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection.destroy();
  }

  private async initializeConnection(): Promise<void> {
    if (this.dialect === 'sqlite') {
      await this.connection.raw('PRAGMA foreign_keys = ON');
      await this.connection.raw('PRAGMA busy_timeout = 5000');
      if (this.sqlitePath !== ':memory:') {
        await this.connection.raw('PRAGMA journal_mode = WAL');
      }
    }

    await this.connection.migrate.latest({ migrationSource });
  }
}

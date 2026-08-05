import type { Knex } from 'knex';
import * as initialSchema from './001-initial-schema';
import * as repositoryConnection from './002-repository-connection';
import * as projectPlanning from './003-project-planning';
import * as projectWorkspace from './004-project-workspace';

const migrations: Record<string, Knex.Migration> = {
  '001-initial-schema': initialSchema,
  '002-repository-connection': repositoryConnection,
  '003-project-planning': projectPlanning,
  '004-project-workspace': projectWorkspace,
};

export const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: () => Promise.resolve(Object.keys(migrations)),
  getMigrationName: (migration) => migration,
  getMigration: (migration) => Promise.resolve(migrations[migration]),
};

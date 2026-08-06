import type { Knex } from 'knex';
import * as initialSchema from './001-initial-schema';
import * as repositoryConnection from './002-repository-connection';
import * as projectPlanning from './003-project-planning';
import * as projectWorkspace from './004-project-workspace';
import * as todayCommandCenter from './005-today-command-center';
import * as todayActivityCategory from './006-today-activity-category';

const migrations: Record<string, Knex.Migration> = {
  '001-initial-schema': initialSchema,
  '002-repository-connection': repositoryConnection,
  '003-project-planning': projectPlanning,
  '004-project-workspace': projectWorkspace,
  '005-today-command-center': todayCommandCenter,
  '006-today-activity-category': todayActivityCategory,
};

export const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: () => Promise.resolve(Object.keys(migrations)),
  getMigrationName: (migration) => migration,
  getMigration: (migration) => Promise.resolve(migrations[migration]),
};

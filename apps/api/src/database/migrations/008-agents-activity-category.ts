import type { Knex } from 'knex';

const categories = [
  'clients',
  'today',
  'projects',
  'repositories',
  'agents',
  'integrations',
  'security',
  'system',
] as const;

function isSqlite(database: Knex): boolean {
  const client = database.client as unknown as { config: { client: string } };
  return client.config.client === 'better-sqlite3';
}

function createActivityTableSql(
  tableName: string,
  allowedCategories: readonly string[] = categories,
): string {
  const allowed = allowedCategories
    .map((category) => `'${category}'`)
    .join(', ');
  return `
    CREATE TABLE ${tableName} (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN (${allowed})),
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
    )
  `;
}

async function recreateSqliteTable(
  database: Knex,
  allowedCategories: readonly string[] = categories,
): Promise<void> {
  await database.raw('DROP TABLE IF EXISTS activity_logs_next');
  await database.raw(
    createActivityTableSql('activity_logs_next', allowedCategories),
  );
  await database.raw(
    'INSERT INTO activity_logs_next SELECT * FROM activity_logs',
  );
  await database.schema.dropTable('activity_logs');
  await database.schema.renameTable('activity_logs_next', 'activity_logs');
  await database.raw(
    'CREATE INDEX activity_logs_created_at_idx ON activity_logs (created_at DESC)',
  );
  await database.raw(
    'CREATE INDEX activity_logs_category_created_at_idx ON activity_logs (category, created_at DESC)',
  );
  await database.raw(
    'CREATE INDEX activity_logs_status_created_at_idx ON activity_logs (status, created_at DESC)',
  );
}

export async function up(database: Knex): Promise<void> {
  if (isSqlite(database)) {
    await recreateSqliteTable(database);
    return;
  }

  await database.raw(
    'ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_category_check',
  );
  await database.raw(`
    ALTER TABLE activity_logs
    ADD CONSTRAINT activity_logs_category_check
    CHECK (category IN (${categories.map((category) => `'${category}'`).join(', ')}))
  `);
}

export async function down(database: Knex): Promise<void> {
  await database('activity_logs')
    .where({ category: 'agents' })
    .update({ category: 'system' });
  const original = categories.filter((category) => category !== 'agents');
  if (isSqlite(database)) {
    await recreateSqliteTable(database, original);
    return;
  }

  await database.raw(
    'ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_category_check',
  );
  await database.raw(`
    ALTER TABLE activity_logs
    ADD CONSTRAINT activity_logs_category_check
    CHECK (category IN (${original.map((category) => `'${category}'`).join(', ')}))
  `);
}

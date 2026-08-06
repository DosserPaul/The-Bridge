import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  if (!(await database.schema.hasColumn('repositories', 'connection_id'))) {
    await database.schema.alterTable('repositories', (table) => {
      table
        .text('connection_id')
        .references('id')
        .inTable('provider_connections')
        .onDelete('SET NULL');
    });
  }

  await database.raw(
    'CREATE INDEX IF NOT EXISTS repositories_connection_id_idx ON repositories (connection_id)',
  );
}

export async function down(database: Knex): Promise<void> {
  if (await database.schema.hasColumn('repositories', 'connection_id')) {
    await database.schema.alterTable('repositories', (table) => {
      table.dropColumn('connection_id');
    });
  }
}

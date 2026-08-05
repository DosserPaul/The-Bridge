import type { Knex } from 'knex';

async function ensureColumn(
  database: Knex,
  tableName: string,
  columnName: string,
  addColumn: (table: Knex.AlterTableBuilder) => void,
): Promise<void> {
  if (await database.schema.hasColumn(tableName, columnName)) return;
  await database.schema.alterTable(tableName, addColumn);
}

export async function up(database: Knex): Promise<void> {
  if (!(await database.schema.hasTable('clients'))) {
    await database.schema.createTable('clients', (table) => {
      table.text('id').primary();
      table.text('name').notNullable();
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('projects'))) {
    await database.schema.createTable('projects', (table) => {
      table.text('id').primary();
      table
        .text('client_id')
        .references('id')
        .inTable('clients')
        .onDelete('SET NULL');
      table.text('name').notNullable();
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('provider_connections'))) {
    await database.schema.createTable('provider_connections', (table) => {
      table.text('id').primary();
      table.text('provider').notNullable();
      table.text('base_url').notNullable();
      table.text('credential_account').notNullable().unique();
      table.text('account_id').notNullable();
      table.text('account_username').notNullable();
      table.text('account_name').notNullable();
      table.text('account_avatar_url');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
      table.unique(['provider', 'base_url']);
    });
  }

  if (!(await database.schema.hasTable('repositories'))) {
    await database.schema.createTable('repositories', (table) => {
      table.text('id').primary();
      table
        .text('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table.text('name').notNullable();
      table.text('local_path').notNullable().unique();
      table.text('remote_url');
      table.text('provider').notNullable();
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('client_contacts'))) {
    await database.schema.createTable('client_contacts', (table) => {
      table.text('id').primary();
      table
        .text('client_id')
        .notNullable()
        .references('id')
        .inTable('clients')
        .onDelete('CASCADE');
      table.text('name').notNullable();
      table.text('role');
      table.text('email');
      table.text('phone');
      table.boolean('is_primary').notNullable().defaultTo(false);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('activity_logs'))) {
    await database.schema.createTable('activity_logs', (table) => {
      table.text('id').primary();
      table.text('request_id').notNullable();
      table.text('category').notNullable();
      table.text('action').notNullable();
      table.text('status').notNullable();
      table.text('method').notNullable();
      table.text('route').notNullable();
      table.text('subject_type');
      table.text('subject_id');
      table.text('summary').notNullable();
      table.text('request_json');
      table.text('response_json');
      table.text('error_json');
      table.integer('http_status').notNullable();
      table.integer('duration_ms').notNullable();
      table.text('created_at').notNullable();
    });
  }

  await ensureColumn(database, 'clients', 'kind', (table) =>
    table.text('kind').notNullable().defaultTo('organization'),
  );
  await ensureColumn(database, 'clients', 'status', (table) =>
    table.text('status').notNullable().defaultTo('active'),
  );
  await ensureColumn(database, 'clients', 'email', (table) =>
    table.text('email'),
  );
  await ensureColumn(database, 'clients', 'phone', (table) =>
    table.text('phone'),
  );
  await ensureColumn(database, 'clients', 'website', (table) =>
    table.text('website'),
  );
  await ensureColumn(database, 'clients', 'notes', (table) =>
    table.text('notes'),
  );
  await ensureColumn(database, 'clients', 'logo_data_url', (table) =>
    table.text('logo_data_url'),
  );

  await ensureColumn(database, 'projects', 'logo_data_url', (table) =>
    table.text('logo_data_url'),
  );
  await ensureColumn(database, 'projects', 'description', (table) =>
    table.text('description'),
  );
  await ensureColumn(database, 'projects', 'status', (table) =>
    table.text('status').notNullable().defaultTo('active'),
  );
  await ensureColumn(database, 'projects', 'priority', (table) =>
    table.text('priority').notNullable().defaultTo('normal'),
  );
  await ensureColumn(database, 'projects', 'types_json', (table) =>
    table.text('types_json').notNullable().defaultTo('[]'),
  );
  await ensureColumn(database, 'projects', 'technologies_json', (table) =>
    table.text('technologies_json').notNullable().defaultTo('[]'),
  );
  await ensureColumn(database, 'projects', 'start_date', (table) =>
    table.text('start_date'),
  );
  await ensureColumn(database, 'projects', 'deadline', (table) =>
    table.text('deadline'),
  );
  await ensureColumn(database, 'projects', 'follow_up_date', (table) =>
    table.text('follow_up_date'),
  );
  await ensureColumn(database, 'projects', 'follow_up_note', (table) =>
    table.text('follow_up_note'),
  );

  const client = database.client as unknown as { config: { client: string } };
  await database.raw(
    client.config.client === 'pg'
      ? 'CREATE UNIQUE INDEX IF NOT EXISTS clients_name_nocase_unique ON clients (LOWER(name))'
      : 'CREATE UNIQUE INDEX IF NOT EXISTS clients_name_nocase_unique ON clients (name COLLATE NOCASE)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects (client_id)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS repositories_project_id_idx ON repositories (project_id)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS provider_connections_provider_idx ON provider_connections (provider)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS client_contacts_client_id_idx ON client_contacts (client_id)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs (created_at DESC)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS activity_logs_category_created_at_idx ON activity_logs (category, created_at DESC)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS activity_logs_status_created_at_idx ON activity_logs (status, created_at DESC)',
  );
}

export async function down(database: Knex): Promise<void> {
  await database.schema
    .dropTableIfExists('activity_logs')
    .dropTableIfExists('client_contacts')
    .dropTableIfExists('repositories')
    .dropTableIfExists('provider_connections')
    .dropTableIfExists('projects')
    .dropTableIfExists('clients');
}

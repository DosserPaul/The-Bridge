import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  if (!(await database.schema.hasTable('project_documents'))) {
    await database.schema.createTable('project_documents', (table) => {
      table.text('id').primary();
      table
        .text('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table
        .text('repository_id')
        .references('id')
        .inTable('repositories')
        .onDelete('CASCADE');
      table.text('kind').notNullable();
      table.text('category').notNullable();
      table.text('title').notNullable();
      table.text('location').notNullable();
      table.text('description');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('project_finances'))) {
    await database.schema.createTable('project_finances', (table) => {
      table
        .text('project_id')
        .primary()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table.integer('daily_rate_cents');
      table.integer('budget_cents');
      table.text('currency').notNullable().defaultTo('EUR');
      table.text('next_invoice_date');
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('project_time_entries'))) {
    await database.schema.createTable('project_time_entries', (table) => {
      table.text('id').primary();
      table
        .text('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table.text('date').notNullable();
      table.integer('duration_minutes').notNullable();
      table.text('description').notNullable();
      table.boolean('billable').notNullable().defaultTo(true);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('local_action_runs'))) {
    await database.schema.createTable('local_action_runs', (table) => {
      table.text('id').primary();
      table
        .text('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table
        .text('repository_id')
        .notNullable()
        .references('id')
        .inTable('repositories')
        .onDelete('CASCADE');
      table.text('action').notNullable();
      table.text('status').notNullable();
      table.text('command_label').notNullable();
      table.text('output').notNullable().defaultTo('');
      table.integer('exit_code');
      table.text('started_at');
      table.text('finished_at');
      table.text('created_at').notNullable();
    });
  }

  await database.raw(
    'CREATE INDEX IF NOT EXISTS project_documents_project_idx ON project_documents (project_id, created_at DESC)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS project_time_entries_project_date_idx ON project_time_entries (project_id, date DESC)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS local_action_runs_project_created_idx ON local_action_runs (project_id, created_at DESC)',
  );
}

export async function down(database: Knex): Promise<void> {
  await database.schema
    .dropTableIfExists('local_action_runs')
    .dropTableIfExists('project_time_entries')
    .dropTableIfExists('project_finances')
    .dropTableIfExists('project_documents');
}

import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  if (!(await database.schema.hasTable('today_focus_items'))) {
    await database.schema.createTable('today_focus_items', (table) => {
      table.text('id').primary();
      table.text('source_key').unique();
      table
        .text('project_id')
        .references('id')
        .inTable('projects')
        .onDelete('SET NULL');
      table.text('title').notNullable();
      table.text('description');
      table.text('href');
      table.text('priority').notNullable().defaultTo('normal');
      table.text('completed_at');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  await database.raw(
    'CREATE INDEX IF NOT EXISTS today_focus_items_active_idx ON today_focus_items (completed_at, created_at DESC)',
  );
}

export async function down(database: Knex): Promise<void> {
  await database.schema.dropTableIfExists('today_focus_items');
}

import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  if (!(await database.schema.hasTable('project_milestones'))) {
    await database.schema.createTable('project_milestones', (table) => {
      table.text('id').primary();
      table
        .text('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table.text('title').notNullable();
      table.text('description');
      table.text('status').notNullable().defaultTo('planned');
      table.text('due_date');
      table.text('risk_level').notNullable().defaultTo('low');
      table.text('blockers');
      table.text('linked_issues_json').notNullable().defaultTo('[]');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('project_decisions'))) {
    await database.schema.createTable('project_decisions', (table) => {
      table.text('id').primary();
      table
        .text('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table.text('title').notNullable();
      table.text('status').notNullable().defaultTo('proposed');
      table.text('context').notNullable();
      table.text('decision').notNullable();
      table.text('rationale');
      table.text('alternatives_json').notNullable().defaultTo('[]');
      table.text('consequences');
      table.text('participants_json').notNullable().defaultTo('[]');
      table.text('decided_at').notNullable();
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  await database.raw(
    'CREATE INDEX IF NOT EXISTS project_milestones_project_due_date_idx ON project_milestones (project_id, due_date)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS project_decisions_project_decided_at_idx ON project_decisions (project_id, decided_at DESC)',
  );
}

export async function down(database: Knex): Promise<void> {
  await database.schema
    .dropTableIfExists('project_decisions')
    .dropTableIfExists('project_milestones');
}

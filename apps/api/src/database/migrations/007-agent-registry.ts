import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  if (!(await database.schema.hasTable('agents'))) {
    await database.schema.createTable('agents', (table) => {
      table.text('id').primary();
      table.text('name').notNullable();
      table.text('slug').notNullable().unique();
      table.text('avatar_data_url');
      table.text('role').notNullable();
      table.text('description');
      table.text('instructions');
      table.text('status').notNullable().defaultTo('draft');
      table.text('runtime_provider');
      table.text('model_id');
      table.text('service_tier');
      table.text('reasoning_level');
      table.text('capabilities_json').notNullable().defaultTo('[]');
      table.text('permission_policy').notNullable().defaultTo('supervised');
      table.text('approval_policy').notNullable().defaultTo('destructive');
      table.integer('monthly_budget_cents');
      table.integer('max_concurrency');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('agent_project_scopes'))) {
    await database.schema.createTable('agent_project_scopes', (table) => {
      table
        .text('agent_id')
        .notNullable()
        .references('id')
        .inTable('agents')
        .onDelete('CASCADE');
      table
        .text('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table.primary(['agent_id', 'project_id']);
    });
  }

  if (!(await database.schema.hasTable('agent_repository_scopes'))) {
    await database.schema.createTable('agent_repository_scopes', (table) => {
      table
        .text('agent_id')
        .notNullable()
        .references('id')
        .inTable('agents')
        .onDelete('CASCADE');
      table
        .text('repository_id')
        .notNullable()
        .references('id')
        .inTable('repositories')
        .onDelete('CASCADE');
      table.primary(['agent_id', 'repository_id']);
    });
  }

  if (!(await database.schema.hasTable('agent_teams'))) {
    await database.schema.createTable('agent_teams', (table) => {
      table.text('id').primary();
      table.text('name').notNullable();
      table.text('slug').notNullable().unique();
      table.text('description');
      table.text('status').notNullable().defaultTo('active');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  if (!(await database.schema.hasTable('agent_team_project_scopes'))) {
    await database.schema.createTable('agent_team_project_scopes', (table) => {
      table
        .text('team_id')
        .notNullable()
        .references('id')
        .inTable('agent_teams')
        .onDelete('CASCADE');
      table
        .text('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');
      table.primary(['team_id', 'project_id']);
    });
  }

  if (!(await database.schema.hasTable('agent_team_assignments'))) {
    await database.schema.createTable('agent_team_assignments', (table) => {
      table.text('id').primary();
      table
        .text('team_id')
        .notNullable()
        .references('id')
        .inTable('agent_teams')
        .onDelete('CASCADE');
      table
        .text('agent_id')
        .notNullable()
        .references('id')
        .inTable('agents')
        .onDelete('RESTRICT');
      table
        .text('parent_assignment_id')
        .references('id')
        .inTable('agent_team_assignments')
        .onDelete('RESTRICT');
      table.text('role').notNullable();
      table.integer('sort_order').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
      table.unique(['team_id', 'agent_id']);
    });
  }

  await database.raw(
    'CREATE INDEX IF NOT EXISTS agents_status_idx ON agents (status)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS agent_project_scopes_project_idx ON agent_project_scopes (project_id)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS agent_repository_scopes_repository_idx ON agent_repository_scopes (repository_id)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS agent_team_assignments_team_idx ON agent_team_assignments (team_id, sort_order)',
  );
  await database.raw(
    'CREATE INDEX IF NOT EXISTS agent_team_assignments_parent_idx ON agent_team_assignments (parent_assignment_id)',
  );
}

export async function down(database: Knex): Promise<void> {
  await database.schema
    .dropTableIfExists('agent_team_assignments')
    .dropTableIfExists('agent_team_project_scopes')
    .dropTableIfExists('agent_teams')
    .dropTableIfExists('agent_repository_scopes')
    .dropTableIfExists('agent_project_scopes')
    .dropTableIfExists('agents');
}

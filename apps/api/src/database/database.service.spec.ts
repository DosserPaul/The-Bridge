import { DatabaseService } from './database.service';

async function expectSchema(database: DatabaseService): Promise<void> {
  const migrations = await database
    .connection('knex_migrations')
    .select('name')
    .orderBy('id');
  const hasConnectionId = await database.connection.schema.hasColumn(
    'repositories',
    'connection_id',
  );
  const hasMilestones =
    await database.connection.schema.hasTable('project_milestones');
  const hasDecisions =
    await database.connection.schema.hasTable('project_decisions');
  const workspaceTables = await Promise.all(
    [
      'project_documents',
      'project_finances',
      'project_time_entries',
      'local_action_runs',
    ].map((table) => database.connection.schema.hasTable(table)),
  );
  const hasTodayFocusItems =
    await database.connection.schema.hasTable('today_focus_items');
  const agentTables = await Promise.all(
    [
      'agents',
      'agent_project_scopes',
      'agent_repository_scopes',
      'agent_teams',
      'agent_team_project_scopes',
      'agent_team_assignments',
    ].map((table) => database.connection.schema.hasTable(table)),
  );

  expect(migrations).toEqual([
    { name: '001-initial-schema' },
    { name: '002-repository-connection' },
    { name: '003-project-planning' },
    { name: '004-project-workspace' },
    { name: '005-today-command-center' },
    { name: '006-today-activity-category' },
    { name: '007-agent-registry' },
    { name: '008-agents-activity-category' },
  ]);
  expect(hasConnectionId).toBe(true);
  expect(hasMilestones).toBe(true);
  expect(hasDecisions).toBe(true);
  expect(workspaceTables).toEqual([true, true, true, true]);
  expect(hasTodayFocusItems).toBe(true);
  expect(agentTables).toEqual([true, true, true, true, true, true]);
  await expect(
    database.connection('activity_logs').insert({
      id: '11111111-1111-4111-8111-111111111111',
      request_id: '22222222-2222-4222-8222-222222222222',
      category: 'today',
      action: 'today.focus.created',
      status: 'success',
      method: 'POST',
      route: '/api/today/focus',
      summary: 'Priorité ajoutée au Focus',
      http_status: 201,
      duration_ms: 1,
      created_at: new Date().toISOString(),
    }),
  ).resolves.toBeDefined();
  await expect(
    database.connection('activity_logs').insert({
      id: '33333333-3333-4333-8333-333333333333',
      request_id: '44444444-4444-4444-8444-444444444444',
      category: 'agents',
      action: 'agent.created',
      status: 'success',
      method: 'POST',
      route: '/api/agents',
      summary: 'Agent créé',
      http_status: 201,
      duration_ms: 1,
      created_at: new Date().toISOString(),
    }),
  ).resolves.toBeDefined();
}

describe('DatabaseService', () => {
  it('applies versioned migrations to SQLite', async () => {
    const database = new DatabaseService(':memory:');

    try {
      await database.initialize();
      await database.initialize();

      expect(database.dialect).toBe('sqlite');
      await expectSchema(database);
    } finally {
      await database.onModuleDestroy();
    }
  });

  const postgresUrl = process.env.TEST_DATABASE_URL;
  const postgresTarget = postgresUrl ?? '';
  const postgresTest = postgresUrl ? it : it.skip;

  postgresTest('applies the same migrations to PostgreSQL', async () => {
    const database = new DatabaseService(postgresTarget);

    try {
      await database.initialize();

      expect(database.dialect).toBe('postgres');
      await expectSchema(database);
    } finally {
      await database.onModuleDestroy();
    }
  });
});

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

  expect(migrations).toEqual([
    { name: '001-initial-schema' },
    { name: '002-repository-connection' },
  ]);
  expect(hasConnectionId).toBe(true);
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

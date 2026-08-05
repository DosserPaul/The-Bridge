import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DATA_BACKUP_FORMAT, DATA_BACKUP_VERSION } from './data.types';
import { DataService } from './data.service';

describe('DataService', () => {
  let directory: string;
  let database: DatabaseService;
  let service: DataService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'the-bridge-data-'));
    database = new DatabaseService(join(directory, 'the-bridge.sqlite'));
    await database.initialize();
    service = new DataService(database);
  });

  afterEach(async () => {
    await database.onModuleDestroy();
    await rm(directory, { recursive: true, force: true });
  });

  it('exports every application table without credential secrets', async () => {
    const now = new Date().toISOString();
    await database.connection('clients').insert({
      id: randomUUID(),
      name: 'Juris Global',
      kind: 'organization',
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    const document = await service.exportDocument();

    expect(document).toMatchObject({
      format: DATA_BACKUP_FORMAT,
      version: DATA_BACKUP_VERSION,
      source: { dialect: 'sqlite' },
    });
    expect(document.data.clients).toHaveLength(1);
    expect(document.data.providerConnections).toEqual([]);
    expect(JSON.stringify(document)).not.toContain('accessToken');
  });

  it('creates a local backup and restores data transactionally', async () => {
    const originalId = randomUUID();
    const now = new Date().toISOString();
    await database.connection('clients').insert({
      id: originalId,
      name: 'Original client',
      kind: 'organization',
      status: 'active',
      created_at: now,
      updated_at: now,
    });
    const document = await service.exportDocument();
    const localBackup = await service.createLocalBackup();

    await database.connection('clients').where({ id: originalId }).delete();
    const result = await service.restoreDocument(document);

    await expect(
      database.connection('clients').where({ id: originalId }).first(),
    ).resolves.toMatchObject({ name: 'Original client' });
    await expect(service.listLocalBackups()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: localBackup.id }),
        expect.objectContaining({ id: result.safetyBackup.id }),
      ]),
    );
  });

  it('rejects an unsupported backup before changing data', async () => {
    await expect(
      service.restoreDocument({
        format: DATA_BACKUP_FORMAT,
        version: 999,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

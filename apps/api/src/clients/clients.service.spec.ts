import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let database: DatabaseService;
  let clients: ClientsService;

  beforeEach(async () => {
    database = new DatabaseService(':memory:');
    await database.initialize();
    clients = new ClientsService(database);
  });

  afterEach(async () => {
    await database.onModuleDestroy();
  });

  it('creates a client with its primary contact', async () => {
    const client = await clients.create({
      name: 'Juris Global',
      kind: 'organization',
      status: 'active',
      email: 'hello@jurisglobal.test',
      website: 'https://jurisglobal.test',
      notes: 'Client historique.',
      logoDataUrl: 'data:image/png;base64,aGVsbG8=',
      primaryContact: {
        name: 'Camille Martin',
        role: 'Direction produit',
        email: 'camille@jurisglobal.test',
      },
    });

    expect(client).toMatchObject({
      name: 'Juris Global',
      kind: 'organization',
      status: 'active',
      projectsCount: 0,
      repositoriesCount: 0,
      logoDataUrl: 'data:image/png;base64,aGVsbG8=',
    });
    expect(client.contacts).toEqual([
      expect.objectContaining({
        name: 'Camille Martin',
        role: 'Direction produit',
        isPrimary: true,
      }),
    ]);
  });

  it('updates client details, logo and primary contact', async () => {
    const client = await clients.create({
      name: 'Defim',
      kind: 'organization',
      status: 'prospect',
      primaryContact: { name: 'Lina Petit' },
    });

    const updated = await clients.update(client.id, {
      name: 'Defim Studio',
      status: 'active',
      email: 'contact@defim.test',
      logoDataUrl: 'data:image/webp;base64,aGVsbG8=',
      primaryContact: {
        name: 'Lina Petit',
        role: 'CEO',
        email: 'lina@defim.test',
      },
    });

    expect(updated).toMatchObject({
      name: 'Defim Studio',
      status: 'active',
      email: 'contact@defim.test',
      logoDataUrl: 'data:image/webp;base64,aGVsbG8=',
      contacts: [
        expect.objectContaining({
          name: 'Lina Petit',
          role: 'CEO',
          isPrimary: true,
        }),
      ],
    });
  });

  it('can remove the logo and primary contact', async () => {
    const client = await clients.create({
      name: 'Defim',
      kind: 'organization',
      status: 'active',
      logoDataUrl: 'data:image/png;base64,aGVsbG8=',
      primaryContact: { name: 'Lina Petit' },
    });

    const updated = await clients.update(client.id, {
      logoDataUrl: null,
      primaryContact: null,
    });

    expect(updated.logoDataUrl).toBeNull();
    expect(updated.contacts).toEqual([]);
  });

  it('reports the projects and repositories attached to a client', async () => {
    const client = await clients.create({
      name: 'Defim',
      kind: 'organization',
      status: 'active',
    });
    const projectId = randomUUID();
    const now = new Date().toISOString();

    await database.connection('projects').insert({
      id: projectId,
      client_id: client.id,
      name: 'Application mobile',
      created_at: now,
      updated_at: now,
    });
    await database.connection('repositories').insert({
      id: randomUUID(),
      project_id: projectId,
      name: 'mobile',
      local_path: '/tmp/defim-mobile',
      provider: 'unknown',
      created_at: now,
      updated_at: now,
    });

    await expect(clients.findOne(client.id)).resolves.toMatchObject({
      projectsCount: 1,
      repositoriesCount: 1,
      projects: [
        expect.objectContaining({
          name: 'Application mobile',
          repositoriesCount: 1,
        }),
      ],
    });
  });

  it('prevents duplicate client names', async () => {
    const input = {
      name: 'Juris Global',
      kind: 'organization' as const,
      status: 'active' as const,
    };

    await clients.create(input);

    await expect(clients.create(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects an unknown client', async () => {
    await expect(clients.findOne(randomUUID())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let database: DatabaseService;
  let clients: ClientsService;

  beforeEach(() => {
    database = new DatabaseService(':memory:');
    clients = new ClientsService(database);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  it('creates a client with its primary contact', () => {
    const client = clients.create({
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

  it('updates client details, logo and primary contact', () => {
    const client = clients.create({
      name: 'Defim',
      kind: 'organization',
      status: 'prospect',
      primaryContact: { name: 'Lina Petit' },
    });

    const updated = clients.update(client.id, {
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

  it('can remove the logo and primary contact', () => {
    const client = clients.create({
      name: 'Defim',
      kind: 'organization',
      status: 'active',
      logoDataUrl: 'data:image/png;base64,aGVsbG8=',
      primaryContact: { name: 'Lina Petit' },
    });

    const updated = clients.update(client.id, {
      logoDataUrl: null,
      primaryContact: null,
    });

    expect(updated.logoDataUrl).toBeNull();
    expect(updated.contacts).toEqual([]);
  });

  it('reports the projects and repositories attached to a client', () => {
    const client = clients.create({
      name: 'Defim',
      kind: 'organization',
      status: 'active',
    });
    const projectId = randomUUID();
    const now = new Date().toISOString();

    database.connection
      .prepare(
        `INSERT INTO projects (id, client_id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(projectId, client.id, 'Application mobile', now, now);
    database.connection
      .prepare(
        `INSERT INTO repositories (
           id, project_id, name, local_path, provider, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        projectId,
        'mobile',
        '/tmp/defim-mobile',
        'unknown',
        now,
        now,
      );

    expect(clients.findOne(client.id)).toMatchObject({
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

  it('prevents duplicate client names', () => {
    const input = {
      name: 'Juris Global',
      kind: 'organization' as const,
      status: 'active' as const,
    };

    clients.create(input);

    expect(() => clients.create(input)).toThrow(ConflictException);
  });

  it('rejects an unknown client', () => {
    expect(() => clients.findOne(randomUUID())).toThrow(NotFoundException);
  });
});

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
    const projectId = randomUUID();
    await database.connection('clients').insert({
      id: randomUUID(),
      name: 'Juris Global',
      kind: 'organization',
      status: 'active',
      created_at: now,
      updated_at: now,
    });
    await database.connection('projects').insert({
      id: projectId,
      name: 'The Bridge',
      created_at: now,
      updated_at: now,
    });
    await database.connection('project_milestones').insert({
      id: randomUUID(),
      project_id: projectId,
      title: 'Public beta',
      linked_issues_json: '[]',
      created_at: now,
      updated_at: now,
    });
    await database.connection('project_decisions').insert({
      id: randomUUID(),
      project_id: projectId,
      title: 'Stay local-first',
      context: 'Credentials are local.',
      decision: 'Keep the API local.',
      decided_at: '2026-08-05',
      created_at: now,
      updated_at: now,
    });
    await database.connection('project_documents').insert({
      id: randomUUID(),
      project_id: projectId,
      kind: 'link',
      category: 'specification',
      title: 'Product specification',
      location: 'https://example.com/specification',
      created_at: now,
      updated_at: now,
    });
    await database.connection('project_finances').insert({
      project_id: projectId,
      daily_rate_cents: 80_000,
      budget_cents: 800_000,
      currency: 'EUR',
      updated_at: now,
    });
    await database.connection('project_time_entries').insert({
      id: randomUUID(),
      project_id: projectId,
      date: '2026-08-06',
      duration_minutes: 120,
      description: 'Workspace implementation',
      billable: true,
      created_at: now,
      updated_at: now,
    });
    await database.connection('today_focus_items').insert({
      id: randomUUID(),
      project_id: projectId,
      title: 'Ship the command center',
      priority: 'high',
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
    expect(document.data.projectMilestones).toHaveLength(1);
    expect(document.data.projectDecisions).toHaveLength(1);
    expect(document.data.projectDocuments).toHaveLength(1);
    expect(document.data.projectFinances).toHaveLength(1);
    expect(document.data.projectTimeEntries).toHaveLength(1);
    expect(document.data.todayFocusItems).toHaveLength(1);
    expect(document.data.agents).toEqual([]);
    expect(document.data.agentTeams).toEqual([]);
    expect(JSON.stringify(document)).not.toContain('accessToken');
  });

  it('restores version 1 backups with empty planning tables', async () => {
    const document = await service.exportDocument();
    const legacy = JSON.parse(JSON.stringify(document)) as {
      version: number;
      data: Record<string, unknown>;
    };
    legacy.version = 1;
    delete legacy.data.projectMilestones;
    delete legacy.data.projectDecisions;
    delete legacy.data.projectDocuments;
    delete legacy.data.projectFinances;
    delete legacy.data.projectTimeEntries;
    delete legacy.data.localActionRuns;
    delete legacy.data.todayFocusItems;
    delete legacy.data.agents;
    delete legacy.data.agentProjectScopes;
    delete legacy.data.agentRepositoryScopes;
    delete legacy.data.agentTeams;
    delete legacy.data.agentTeamProjectScopes;
    delete legacy.data.agentTeamAssignments;

    const result = await service.restoreDocument(legacy);

    expect(result.counts.projectMilestones).toBe(0);
    expect(result.counts.projectDecisions).toBe(0);
    expect(result.counts.projectDocuments).toBe(0);
    expect(result.counts.projectFinances).toBe(0);
    expect(result.counts.projectTimeEntries).toBe(0);
    expect(result.counts.localActionRuns).toBe(0);
    expect(result.counts.todayFocusItems).toBe(0);
    expect(result.counts.agents).toBe(0);
    expect(result.counts.agentTeams).toBe(0);
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

  it('restores hierarchical agent assignments without orphaning members', async () => {
    const now = new Date().toISOString();
    const leadId = randomUUID();
    const developerId = randomUUID();
    const teamId = randomUUID();
    const leadAssignmentId = randomUUID();
    const developerAssignmentId = randomUUID();
    await database.connection('agents').insert([
      {
        id: leadId,
        name: 'CTO',
        slug: 'cto',
        role: 'CTO',
        created_at: now,
        updated_at: now,
      },
      {
        id: developerId,
        name: 'API Lead',
        slug: 'api-lead',
        role: 'API Lead',
        created_at: now,
        updated_at: now,
      },
    ]);
    await database.connection('agent_teams').insert({
      id: teamId,
      name: 'Engineering',
      slug: 'engineering',
      created_at: now,
      updated_at: now,
    });
    await database.connection('agent_team_assignments').insert({
      id: leadAssignmentId,
      team_id: teamId,
      agent_id: leadId,
      role: 'CTO',
      created_at: now,
      updated_at: now,
    });
    await database.connection('agent_team_assignments').insert({
      id: developerAssignmentId,
      team_id: teamId,
      agent_id: developerId,
      parent_assignment_id: leadAssignmentId,
      role: 'API Lead',
      created_at: now,
      updated_at: now,
    });

    const document = await service.exportDocument();
    await service.restoreDocument(document);

    await expect(
      database
        .connection('agent_team_assignments')
        .where({ id: developerAssignmentId })
        .first(),
    ).resolves.toMatchObject({ parent_assignment_id: leadAssignmentId });
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

import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ProjectPlanningService } from './project-planning.service';

describe('ProjectPlanningService', () => {
  let directory: string;
  let database: DatabaseService;
  let service: ProjectPlanningService;
  let projectId: string;
  let repositoryId: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'the-bridge-planning-'));
    database = new DatabaseService(join(directory, 'the-bridge.sqlite'));
    await database.initialize();
    service = new ProjectPlanningService(database);
    projectId = randomUUID();
    repositoryId = randomUUID();
    const now = new Date().toISOString();
    await database.connection('projects').insert({
      id: projectId,
      name: 'The Bridge',
      created_at: now,
      updated_at: now,
    });
    await database.connection('repositories').insert({
      id: repositoryId,
      project_id: projectId,
      name: 'The-Bridge',
      local_path: join(directory, 'repository'),
      provider: 'github',
      created_at: now,
      updated_at: now,
    });
  });

  afterEach(async () => {
    await database.onModuleDestroy();
    await rm(directory, { recursive: true, force: true });
  });

  it('creates, updates and removes a milestone with linked issues', async () => {
    const milestone = await service.createMilestone(projectId, {
      title: 'Public beta',
      status: 'active',
      dueDate: '2026-09-15',
      riskLevel: 'medium',
      blockers: 'Provider permissions',
      linkedIssues: [
        {
          repositoryId,
          repositoryName: 'The-Bridge',
          number: 12,
          title: 'Ship the roadmap',
          webUrl: 'https://github.com/DosserPaul/The-Bridge/issues/12',
        },
      ],
    });

    expect(milestone).toMatchObject({
      title: 'Public beta',
      riskLevel: 'medium',
      linkedIssues: [{ repositoryId, number: 12 }],
    });

    await expect(
      service.updateMilestone(projectId, milestone.id, {
        status: 'completed',
      }),
    ).resolves.toMatchObject({ status: 'completed' });

    await service.removeMilestone(projectId, milestone.id);
    await expect(service.listMilestones(projectId)).resolves.toEqual([]);
  });

  it('rejects an issue linked from another project', async () => {
    await expect(
      service.createMilestone(projectId, {
        title: 'Invalid milestone',
        linkedIssues: [
          {
            repositoryId: randomUUID(),
            repositoryName: 'Other',
            number: 1,
            title: 'Other issue',
            webUrl: 'https://github.com/example/other/issues/1',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates, updates and removes a project decision', async () => {
    const decision = await service.createDecision(projectId, {
      title: 'Use a local-first architecture',
      status: 'accepted',
      context: 'Provider credentials must remain local.',
      decision: 'Run the API on the workstation.',
      rationale: 'It keeps control in the hands of the freelancer.',
      alternatives: ['Cloud-only backend'],
      participants: ['Paul'],
      decidedAt: '2026-08-05',
    });

    expect(decision).toMatchObject({
      status: 'accepted',
      alternatives: ['Cloud-only backend'],
      participants: ['Paul'],
    });

    await expect(
      service.updateDecision(projectId, decision.id, {
        status: 'superseded',
        consequences: 'Revisit after the public beta.',
      }),
    ).resolves.toMatchObject({
      status: 'superseded',
      consequences: 'Revisit after the public beta.',
    });

    await service.removeDecision(projectId, decision.id);
    await expect(service.listDecisions(projectId)).resolves.toEqual([]);
  });
});

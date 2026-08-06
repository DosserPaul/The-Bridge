import { ConflictException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import { ProjectIssuesService } from '../integrations/project-issues.service';
import { ProjectOperationsService } from '../integrations/project-operations.service';
import { ProjectPipelinesService } from '../integrations/project-pipelines.service';
import { ProjectsService } from '../projects/projects.service';
import type { ProjectView } from '../projects/projects.types';
import { TodayService } from './today.service';

const project: ProjectView = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'The Bridge',
  logoDataUrl: null,
  description: null,
  status: 'active',
  priority: 'high',
  types: ['web'],
  technologies: ['Next.js'],
  startDate: '2026-08-01',
  deadline: '2026-08-08',
  followUp: { date: '2026-08-06', note: 'Send the weekly update.' },
  client: null,
  repositories: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      connectionId: null,
      name: 'The-Bridge',
      localPath: '/tmp/the-bridge',
      remoteUrl: null,
      provider: 'unknown',
      state: {
        availability: 'available',
        branch: 'develop',
        detached: false,
        head: null,
        isDirty: true,
        changedFilesCount: 2,
      },
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('TodayService', () => {
  let database: DatabaseService;
  let service: TodayService;

  beforeEach(async () => {
    database = new DatabaseService(':memory:');
    await database.initialize();
    await database.connection('projects').insert({
      id: project.id,
      name: project.name,
      priority: project.priority,
      types_json: '[]',
      technologies_json: '[]',
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    });

    const projects = {
      findAll: jest.fn().mockResolvedValue([project]),
    } as unknown as ProjectsService;
    const pipelines = {
      findForProject: jest.fn().mockResolvedValue({
        projectId: project.id,
        repositories: [],
      }),
    } as unknown as ProjectPipelinesService;
    const operations = {
      findPullRequests: jest.fn().mockResolvedValue({
        projectId: project.id,
        repositories: [],
      }),
    } as unknown as ProjectOperationsService;
    const issues = {
      findForProject: jest.fn().mockResolvedValue({
        projectId: project.id,
        repositories: [],
      }),
    } as unknown as ProjectIssuesService;
    service = new TodayService(
      database,
      projects,
      pipelines,
      operations,
      issues,
      new ActivityService(database),
    );
  });

  afterEach(async () => database.onModuleDestroy());

  it('builds a deterministic daily briefing from local project state', async () => {
    const view = await service.get(new Date('2026-08-06T10:00:00.000Z'));

    expect(view.summary).toMatchObject({
      activeProjects: 1,
      critical: 0,
      dueSoon: 2,
    });
    expect(view.signals.map((signal) => signal.kind)).toEqual(
      expect.arrayContaining([
        'deadline',
        'follow_up',
        'priority',
        'repository',
      ]),
    );
    expect(view.degradedSources).toEqual([]);
  });

  it('limits the active focus to three priorities and allows restoration', async () => {
    const first = await service.addFocus({
      sourceKey: 'signal:one',
      projectId: project.id,
      title: 'First priority',
      href: `/projects/${project.id}`,
    });
    await service.addFocus({ title: 'Second priority' });
    await service.addFocus({ title: 'Third priority' });

    await expect(
      service.addFocus({ title: 'Fourth priority' }),
    ).rejects.toBeInstanceOf(ConflictException);

    await service.updateFocus(first.id, { completed: true });
    await expect(
      service.addFocus({ title: 'Fourth priority' }),
    ).resolves.toMatchObject({ title: 'Fourth priority' });

    await expect(
      service.updateFocus(first.id, { completed: false }),
    ).rejects.toBeInstanceOf(ConflictException);
    await service.removeFocus(first.id);
  });
});

import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { GitHubClientService } from './github-client.service';
import { GitLabClientService } from './gitlab-client.service';
import {
  IntegrationsService,
  type GitHubConnectionRecord,
  type GitLabConnectionRecord,
} from './integrations.service';
import {
  parseGitRemote,
  ProjectPipelinesService,
} from './project-pipelines.service';

describe('parseGitRemote', () => {
  it.each([
    ['git@gitlab.com:group/project.git', 'gitlab.com', 'group/project'],
    [
      'https://gitlab.example.com/group/project.git',
      'gitlab.example.com',
      'group/project',
    ],
    [
      'ssh://git@gitlab.example.com:2222/group/project.git',
      'gitlab.example.com',
      'group/project',
    ],
  ])('parses %s', (remoteUrl, hostname, projectPath) => {
    expect(parseGitRemote(remoteUrl)).toEqual({ hostname, projectPath });
  });
});

describe('ProjectPipelinesService', () => {
  let database: DatabaseService;
  const projectId = randomUUID();
  const repositoryId = randomUUID();

  beforeEach(async () => {
    database = new DatabaseService(':memory:');
    await database.initialize();
    const now = new Date().toISOString();
    await database.connection('projects').insert({
      id: projectId,
      name: 'JurisLive',
      created_at: now,
      updated_at: now,
    });
    await database.connection('repositories').insert({
      id: repositoryId,
      project_id: projectId,
      name: 'api',
      local_path: '/tmp/jurislive-api',
      remote_url: 'git@gitlab.com:juris/api.git',
      provider: 'gitlab',
      created_at: now,
      updated_at: now,
    });
  });

  afterEach(async () => database.onModuleDestroy());

  it('asks for a connection when a GitLab remote has no matching account', async () => {
    const integrations = {
      findAllGitLabRecords: jest.fn().mockResolvedValue([]),
      findAllGitHubRecords: jest.fn().mockResolvedValue([]),
    };
    const service = new ProjectPipelinesService(
      database,
      integrations as unknown as IntegrationsService,
      {} as GitLabClientService,
      {} as GitHubClientService,
    );

    await expect(service.findForProject(projectId)).resolves.toEqual({
      projectId,
      repositories: [
        expect.objectContaining({
          repositoryId,
          state: 'connection_required',
          pipelines: [],
        }),
      ],
    });
  });

  it('loads normalized pipelines with the matching secure connection', async () => {
    const connection: GitLabConnectionRecord = {
      id: randomUUID(),
      provider: 'gitlab',
      baseUrl: 'https://gitlab.com',
      credentialAccount: 'gitlab:test',
      accountId: '42',
      accountUsername: 'paul',
      accountName: 'Paul',
      accountAvatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const integrations = {
      findAllGitLabRecords: jest.fn().mockResolvedValue([connection]),
      findAllGitHubRecords: jest.fn().mockResolvedValue([]),
      readToken: jest.fn().mockResolvedValue('glpat-secret'),
    };
    const gitlab = {
      listPipelines: jest.fn().mockResolvedValue([
        {
          id: '18',
          number: 18,
          status: 'success',
          ref: 'main',
          sha: '1234567890abcdef',
          shortSha: '12345678',
          webUrl: 'https://gitlab.com/juris/api/-/pipelines/18',
          createdAt: '2026-08-05T08:00:00Z',
          updatedAt: '2026-08-05T08:01:00Z',
        },
      ]),
    };
    const service = new ProjectPipelinesService(
      database,
      integrations as unknown as IntegrationsService,
      gitlab as unknown as GitLabClientService,
      {} as GitHubClientService,
    );

    const result = await service.findForProject(projectId);

    expect(gitlab.listPipelines).toHaveBeenCalledWith(
      'https://gitlab.com',
      'glpat-secret',
      'juris/api',
    );
    expect(result.repositories[0]).toMatchObject({
      state: 'ready',
      pipelines: [expect.objectContaining({ status: 'success' })],
    });
  });

  it('loads GitHub Actions for a GitHub repository', async () => {
    await database
      .connection('repositories')
      .where({ id: repositoryId })
      .update({
        remote_url: 'git@github.com:DosserPaul/The-Bridge.git',
        provider: 'github',
      });
    const connection: GitHubConnectionRecord = {
      id: randomUUID(),
      provider: 'github',
      baseUrl: 'https://github.com',
      credentialAccount: 'github:test',
      accountId: '84',
      accountUsername: 'pauldosser',
      accountName: 'Paul',
      accountAvatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const integrations = {
      findAllGitLabRecords: jest.fn().mockResolvedValue([]),
      findAllGitHubRecords: jest.fn().mockResolvedValue([connection]),
      readToken: jest.fn().mockResolvedValue('github-pat-secret'),
    };
    const github = {
      listWorkflowRuns: jest.fn().mockResolvedValue([
        {
          id: '912',
          number: 18,
          status: 'success',
          ref: 'develop',
          sha: '1234567890abcdef',
          shortSha: '12345678',
          webUrl: 'https://github.com/DosserPaul/The-Bridge/actions/runs/912',
          createdAt: '2026-08-05T14:00:00Z',
          updatedAt: '2026-08-05T14:01:00Z',
        },
      ]),
    };
    const service = new ProjectPipelinesService(
      database,
      integrations as unknown as IntegrationsService,
      {} as GitLabClientService,
      github as unknown as GitHubClientService,
    );

    await expect(service.findForProject(projectId)).resolves.toEqual({
      projectId,
      repositories: [
        expect.objectContaining({
          provider: 'github',
          state: 'ready',
          pipelines: [expect.objectContaining({ status: 'success' })],
        }),
      ],
    });
    expect(github.listWorkflowRuns).toHaveBeenCalledWith(
      'github-pat-secret',
      'DosserPaul/The-Bridge',
    );
  });
});

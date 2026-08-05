import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { GitLabClientService } from './gitlab-client.service';
import {
  IntegrationsService,
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

  beforeEach(() => {
    database = new DatabaseService(':memory:');
    const now = new Date().toISOString();
    database.connection
      .prepare(
        `INSERT INTO projects (id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(projectId, 'JurisLive', now, now);
    database.connection
      .prepare(
        `INSERT INTO repositories (
           id, project_id, name, local_path, remote_url, provider,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        repositoryId,
        projectId,
        'api',
        '/tmp/jurislive-api',
        'git@gitlab.com:juris/api.git',
        'gitlab',
        now,
        now,
      );
  });

  afterEach(() => database.onModuleDestroy());

  it('asks for a connection when a GitLab remote has no matching account', async () => {
    const integrations = {
      findAllGitLabRecords: jest.fn().mockReturnValue([]),
    };
    const service = new ProjectPipelinesService(
      database,
      integrations as unknown as IntegrationsService,
      {} as GitLabClientService,
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
      findAllGitLabRecords: jest.fn().mockReturnValue([connection]),
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
});

import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { GitService } from '../projects/git.service';
import { RepositoryCatalogService } from '../repositories/repository-catalog.service';
import { GitHubClientService } from './github-client.service';
import { GitLabClientService } from './gitlab-client.service';
import {
  IntegrationsService,
  type GitHubConnectionRecord,
} from './integrations.service';
import { ProjectIssuesService } from './project-issues.service';

describe('ProjectIssuesService', () => {
  let database: DatabaseService;
  let repositoryCatalog: RepositoryCatalogService;
  const projectId = randomUUID();
  const repositoryId = randomUUID();

  beforeEach(async () => {
    database = new DatabaseService(':memory:');
    await database.initialize();
    repositoryCatalog = new RepositoryCatalogService(
      database,
      new GitService(),
    );
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
      name: 'bridge',
      local_path: '/tmp/the-bridge',
      remote_url: 'git@github.com:DosserPaul/The-Bridge.git',
      provider: 'github',
      created_at: now,
      updated_at: now,
    });
  });

  afterEach(async () => database.onModuleDestroy());

  it('loads normalized issues with the associated connection', async () => {
    const connection: GitHubConnectionRecord = {
      id: randomUUID(),
      provider: 'github',
      baseUrl: 'https://github.com',
      credentialAccount: 'github:test',
      accountId: '84',
      accountUsername: 'paul',
      accountName: 'Paul',
      accountAvatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await database.connection('provider_connections').insert({
      id: connection.id,
      provider: connection.provider,
      base_url: connection.baseUrl,
      credential_account: connection.credentialAccount,
      account_id: connection.accountId,
      account_username: connection.accountUsername,
      account_name: connection.accountName,
      account_avatar_url: connection.accountAvatarUrl,
      created_at: connection.createdAt,
      updated_at: connection.updatedAt,
    });
    await database
      .connection('repositories')
      .where({ id: repositoryId })
      .update({ connection_id: connection.id });

    const integrations = {
      findAllGitLabRecords: jest.fn().mockResolvedValue([]),
      findAllGitHubRecords: jest.fn().mockResolvedValue([connection]),
      readToken: jest.fn().mockResolvedValue('github-pat-secret'),
    };
    const github = {
      listIssues: jest.fn().mockResolvedValue([
        {
          id: '41',
          number: 12,
          title: 'Add issues',
          state: 'open',
          author: { username: 'paul', avatarUrl: null },
          assignees: [],
          labels: ['feature'],
          commentCount: 0,
          webUrl: 'https://github.com/paul/bridge/issues/12',
          createdAt: '2026-08-01T10:00:00Z',
          updatedAt: '2026-08-05T10:00:00Z',
        },
      ]),
    };
    const service = new ProjectIssuesService(
      database,
      repositoryCatalog,
      integrations as unknown as IntegrationsService,
      {} as GitLabClientService,
      github as unknown as GitHubClientService,
    );

    await expect(service.findForProject(projectId)).resolves.toEqual({
      projectId,
      repositories: [
        expect.objectContaining({
          repositoryId,
          provider: 'github',
          state: 'ready',
          issues: [expect.objectContaining({ number: 12 })],
        }),
      ],
    });
    expect(github.listIssues).toHaveBeenCalledWith(
      'github-pat-secret',
      'DosserPaul/The-Bridge',
    );
  });

  it('loads an issue detail through the repository connection', async () => {
    const connection: GitHubConnectionRecord = {
      id: randomUUID(),
      provider: 'github',
      baseUrl: 'https://github.com',
      credentialAccount: 'github:detail',
      accountId: '84',
      accountUsername: 'paul',
      accountName: 'Paul',
      accountAvatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await database.connection('provider_connections').insert({
      id: connection.id,
      provider: connection.provider,
      base_url: connection.baseUrl,
      credential_account: connection.credentialAccount,
      account_id: connection.accountId,
      account_username: connection.accountUsername,
      account_name: connection.accountName,
      account_avatar_url: connection.accountAvatarUrl,
      created_at: connection.createdAt,
      updated_at: connection.updatedAt,
    });
    await database
      .connection('repositories')
      .where({ id: repositoryId })
      .update({ connection_id: connection.id });
    const integrations = {
      findAllGitLabRecords: jest.fn().mockResolvedValue([]),
      findAllGitHubRecords: jest.fn().mockResolvedValue([connection]),
      readToken: jest.fn().mockResolvedValue('github-pat-secret'),
    };
    const github = {
      getIssue: jest.fn().mockResolvedValue({
        id: '41',
        number: 12,
        title: 'Add issues',
        body: 'Issue detail',
        state: 'open',
        author: { username: 'paul', avatarUrl: null },
        assignees: [],
        labels: [],
        commentCount: 0,
        comments: [],
        webUrl: 'https://github.com/paul/bridge/issues/12',
        createdAt: '2026-08-01T10:00:00Z',
        updatedAt: '2026-08-05T10:00:00Z',
      }),
    };
    const service = new ProjectIssuesService(
      database,
      repositoryCatalog,
      integrations as unknown as IntegrationsService,
      {} as GitLabClientService,
      github as unknown as GitHubClientService,
    );

    await expect(
      service.findIssue(projectId, repositoryId, 12),
    ).resolves.toMatchObject({
      projectId,
      repositoryId,
      repositoryName: 'bridge',
      provider: 'github',
      issue: { number: 12, body: 'Issue detail' },
    });
    expect(github.getIssue).toHaveBeenCalledWith(
      'github-pat-secret',
      'DosserPaul/The-Bridge',
      12,
    );
  });
});

import { DatabaseService } from '../database/database.service';
import { GitHubClientService } from './github-client.service';
import { GitLabClientService } from './gitlab-client.service';
import { IntegrationsService } from './integrations.service';
import { KeychainCredentialService } from './keychain-credential.service';

describe('IntegrationsService', () => {
  let database: DatabaseService;
  let credentials: jest.Mocked<
    Pick<KeychainCredentialService, 'store' | 'read' | 'remove'>
  >;
  let gitlab: jest.Mocked<Pick<GitLabClientService, 'validateConnection'>>;
  let github: jest.Mocked<Pick<GitHubClientService, 'validateConnection'>>;
  let integrations: IntegrationsService;

  beforeEach(() => {
    database = new DatabaseService(':memory:');
    credentials = {
      store: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockResolvedValue('secret-token'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    gitlab = {
      validateConnection: jest.fn().mockResolvedValue({
        id: '42',
        username: 'paul',
        name: 'Paul',
        avatarUrl: 'https://gitlab.com/uploads/avatar.png',
      }),
    };
    github = {
      validateConnection: jest.fn().mockResolvedValue({
        id: '84',
        username: 'pauldosser',
        name: 'Paul Dosser',
        avatarUrl: 'https://avatars.githubusercontent.com/u/84',
      }),
    };
    integrations = new IntegrationsService(
      database,
      credentials as unknown as KeychainCredentialService,
      gitlab as unknown as GitLabClientService,
      github as unknown as GitHubClientService,
    );
  });

  it('connects GitHub and keeps its token exclusively in the keychain', async () => {
    const connection = await integrations.connectGitHub({
      token: 'github_pat_secret',
    });

    expect(github.validateConnection).toHaveBeenCalledWith('github_pat_secret');
    expect(credentials.store).toHaveBeenCalledWith(
      expect.stringMatching(/^github:/),
      'github_pat_secret',
    );
    expect(connection).toMatchObject({
      provider: 'github',
      baseUrl: 'https://github.com',
      account: { username: 'pauldosser' },
      credentialState: 'available',
    });

    const stored = database.connection
      .prepare(
        `SELECT provider, base_url, credential_account
         FROM provider_connections
         WHERE provider = 'github'`,
      )
      .get() as Record<string, unknown>;
    expect(stored).toMatchObject({
      provider: 'github',
      base_url: 'https://github.com',
    });
    expect(JSON.stringify(stored)).not.toContain('github_pat_secret');
  });

  it('lists and disconnects a GitHub connection', async () => {
    const connection = await integrations.connectGitHub({
      token: 'github_pat_secret',
    });

    await expect(integrations.listGitHubConnections()).resolves.toEqual([
      expect.objectContaining({
        id: connection.id,
        provider: 'github',
        credentialState: 'available',
      }),
    ]);

    await integrations.disconnectGitHub(connection.id);
    expect(credentials.remove).toHaveBeenCalledWith(
      expect.stringMatching(/^github:/),
    );
    await expect(integrations.listGitHubConnections()).resolves.toEqual([]);
  });

  afterEach(() => database.onModuleDestroy());

  it('validates the token and stores only its keychain account in SQLite', async () => {
    const connection = await integrations.connectGitLab({
      baseUrl: 'https://gitlab.com/',
      token: 'glpat-secret',
    });

    expect(gitlab.validateConnection).toHaveBeenCalledWith(
      'https://gitlab.com',
      'glpat-secret',
    );
    expect(credentials.store).toHaveBeenCalledWith(
      expect.stringMatching(/^gitlab:/),
      'glpat-secret',
    );
    expect(connection).toMatchObject({
      baseUrl: 'https://gitlab.com',
      account: { username: 'paul' },
      credentialState: 'available',
    });

    const stored = database.connection
      .prepare('SELECT * FROM provider_connections')
      .get() as Record<string, unknown>;
    expect(stored).not.toHaveProperty('token');
    expect(JSON.stringify(stored)).not.toContain('glpat-secret');
  });

  it('reports a connection whose keychain credential disappeared', async () => {
    await integrations.connectGitLab({
      baseUrl: 'https://gitlab.com',
      token: 'glpat-secret',
    });
    credentials.read.mockResolvedValue(null);

    await expect(integrations.listGitLabConnections()).resolves.toEqual([
      expect.objectContaining({ credentialState: 'missing' }),
    ]);
  });

  it('removes both metadata and the keychain credential', async () => {
    const connection = await integrations.connectGitLab({
      baseUrl: 'https://gitlab.com',
      token: 'glpat-secret',
    });

    await integrations.disconnectGitLab(connection.id);

    expect(credentials.remove).toHaveBeenCalledWith(
      expect.stringMatching(/^gitlab:/),
    );
    await expect(integrations.listGitLabConnections()).resolves.toEqual([]);
  });
});

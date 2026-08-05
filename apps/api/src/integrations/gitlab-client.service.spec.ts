import { GitLabClientService } from './gitlab-client.service';

describe('GitLabClientService', () => {
  const gitlab = new GitLabClientService();

  afterEach(() => jest.restoreAllMocks());

  it('validates a token against the current GitLab account', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 42,
          username: 'paul',
          name: 'Paul',
          avatar_url: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      gitlab.validateConnection('https://gitlab.com', 'glpat-secret'),
    ).resolves.toEqual({
      id: '42',
      username: 'paul',
      name: 'Paul',
      avatarUrl: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': 'glpat-secret',
        }) as unknown,
      }),
    );
  });

  it('normalizes GitLab pipeline states and identifiers', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 18,
            status: 'waiting_for_resource',
            ref: 'main',
            sha: '1234567890abcdef',
            web_url: 'https://gitlab.com/group/project/-/pipelines/18',
            created_at: '2026-08-05T08:00:00Z',
            updated_at: '2026-08-05T08:01:00Z',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      gitlab.listPipelines(
        'https://gitlab.com',
        'glpat-secret',
        'group/project',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '18',
        number: 18,
        status: 'pending',
        shortSha: '12345678',
      }),
    ]);
  });

  it('lists repositories belonging to the connected account', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 42,
            name: 'the-bridge',
            path_with_namespace: 'paul/the-bridge',
            description: null,
            web_url: 'https://gitlab.com/paul/the-bridge',
            http_url_to_repo: 'https://gitlab.com/paul/the-bridge.git',
            visibility: 'private',
            default_branch: 'main',
            last_activity_at: '2026-08-05T12:00:00Z',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      gitlab.listRepositories(
        'https://gitlab.com',
        'glpat-secret',
        'connection-id',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '42',
        provider: 'gitlab',
        connectionId: 'connection-id',
        fullName: 'paul/the-bridge',
      }),
    ]);
  });
});

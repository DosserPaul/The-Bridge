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

  it('lists and normalizes GitLab issues', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 98,
            iid: 17,
            title: 'Expose project issues',
            state: 'opened',
            author: { username: 'paul', avatar_url: null },
            assignees: [{ username: 'codex', avatar_url: null }],
            labels: ['feature'],
            user_notes_count: 4,
            web_url: 'https://gitlab.com/group/project/-/issues/17',
            created_at: '2026-08-01T10:00:00Z',
            updated_at: '2026-08-05T10:00:00Z',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      gitlab.listIssues('https://gitlab.com', 'glpat-secret', 'group/project'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '98',
        number: 17,
        state: 'open',
        labels: ['feature'],
        commentCount: 4,
      }),
    ]);
  });

  it('loads a GitLab issue body and excludes system notes', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 98,
            iid: 17,
            title: 'Expose project issues',
            description: '## Goal\n\nShow the detail.',
            state: 'opened',
            author: { username: 'paul', avatar_url: null },
            assignees: [],
            labels: ['feature'],
            user_notes_count: 2,
            web_url: 'https://gitlab.com/group/project/-/issues/17',
            created_at: '2026-08-01T10:00:00Z',
            updated_at: '2026-08-05T10:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              author: { username: 'gitlab-bot', avatar_url: null },
              body: 'changed label',
              system: true,
              created_at: '2026-08-05T10:30:00Z',
              updated_at: '2026-08-05T10:30:00Z',
            },
            {
              id: 2,
              author: { username: 'codex', avatar_url: null },
              body: 'Implemented.',
              system: false,
              created_at: '2026-08-05T11:00:00Z',
              updated_at: '2026-08-05T11:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(
      gitlab.getIssue(
        'https://gitlab.com',
        'glpat-secret',
        'group/project',
        17,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        body: '## Goal\n\nShow the detail.',
        comments: [expect.objectContaining({ id: '2', body: 'Implemented.' })],
      }),
    );
  });

  it('normalizes GitLab merge requests and pipeline state', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 81,
            iid: 14,
            title: 'Add deployments',
            description: 'Deployment details.',
            state: 'opened',
            draft: false,
            author: { username: 'paul', avatar_url: null },
            reviewers: [{ username: 'codex', avatar_url: null }],
            labels: ['feature'],
            source_branch: 'feature/deployments',
            target_branch: 'develop',
            sha: '1234567890abcdef',
            merge_status: 'can_be_merged',
            detailed_merge_status: 'mergeable',
            has_conflicts: false,
            head_pipeline: { status: 'running' },
            web_url: 'https://gitlab.com/group/project/-/merge_requests/14',
            created_at: '2026-08-05T10:00:00Z',
            updated_at: '2026-08-05T11:00:00Z',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      gitlab.listPullRequests(
        'https://gitlab.com',
        'glpat-secret',
        'group/project',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        number: 14,
        state: 'open',
        pipelineStatus: 'running',
        mergeable: true,
      }),
    ]);
  });

  it('normalizes GitLab environments and latest deployment', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 31,
            name: 'production',
            state: 'available',
            external_url: 'https://project.example.com',
            updated_at: '2026-08-05T11:00:00Z',
            last_deployment: {
              id: 32,
              status: 'success',
              ref: 'main',
              sha: '1234567890abcdef',
              created_at: '2026-08-05T10:00:00Z',
              updated_at: '2026-08-05T10:05:00Z',
            },
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      gitlab.listEnvironments(
        'https://gitlab.com',
        'glpat-secret',
        'group/project',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        name: 'production',
        state: 'success',
        deploymentId: '32',
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

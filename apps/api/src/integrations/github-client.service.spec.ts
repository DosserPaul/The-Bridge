import { UnauthorizedException } from '@nestjs/common';
import { GitHubClientService } from './github-client.service';

describe('GitHubClientService', () => {
  const github = new GitHubClientService();

  afterEach(() => jest.restoreAllMocks());

  it('validates a fine-grained token against the authenticated user', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 84,
          login: 'pauldosser',
          name: 'Paul Dosser',
          avatar_url: 'https://avatars.githubusercontent.com/u/84',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      github.validateConnection('github_pat_secret'),
    ).resolves.toEqual({
      id: '84',
      username: 'pauldosser',
      name: 'Paul Dosser',
      avatarUrl: 'https://avatars.githubusercontent.com/u/84',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer github_pat_secret',
          'X-GitHub-Api-Version': '2026-03-10',
        }) as unknown,
      }),
    );
  });

  it('uses the login when the profile name is empty', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 84,
          login: 'pauldosser',
          name: null,
          avatar_url: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      github.validateConnection('github_pat_secret'),
    ).resolves.toMatchObject({ name: 'pauldosser' });
  });

  it('rejects an invalid token with an actionable error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Bad credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(github.validateConnection('invalid')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lists and normalizes repositories available to the account', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 123,
            name: 'the-bridge',
            full_name: 'pauldosser/the-bridge',
            description: 'Mission control',
            html_url: 'https://github.com/pauldosser/the-bridge',
            clone_url: 'https://github.com/pauldosser/the-bridge.git',
            private: true,
            default_branch: 'main',
            updated_at: '2026-08-05T12:00:00Z',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      github.listRepositories('github_pat_secret', 'connection-id'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '123',
        provider: 'github',
        connectionId: 'connection-id',
        fullName: 'pauldosser/the-bridge',
        visibility: 'private',
      }),
    ]);
  });

  it('lists and normalizes the five latest GitHub Actions runs', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          workflow_runs: [
            {
              id: 912,
              run_number: 18,
              status: 'completed',
              conclusion: 'success',
              head_branch: 'develop',
              head_sha: '1234567890abcdef',
              html_url:
                'https://github.com/DosserPaul/The-Bridge/actions/runs/912',
              created_at: '2026-08-05T14:00:00Z',
              updated_at: '2026-08-05T14:01:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      github.listWorkflowRuns('github_pat_secret', 'DosserPaul/The-Bridge'),
    ).resolves.toEqual([
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
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/DosserPaul/The-Bridge/actions/runs?per_page=5',
      expect.any(Object),
    );
  });

  it('explains how to restore access to private repository Actions', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      github.listWorkflowRuns(
        'github_pat_without_repository_access',
        'DosserPaul/The-Bridge',
      ),
    ).rejects.toThrow(
      'Ajoutez DosserPaul/The-Bridge aux repositories autorisés du token',
    );
  });

  it('lists issues without mixing in pull requests', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 41,
            number: 12,
            title: 'Add the issues panel',
            state: 'open',
            user: { login: 'paul', avatar_url: null },
            assignees: [{ login: 'codex', avatar_url: null }],
            labels: [{ name: 'enhancement' }],
            comments: 3,
            html_url: 'https://github.com/paul/bridge/issues/12',
            created_at: '2026-08-01T10:00:00Z',
            updated_at: '2026-08-05T10:00:00Z',
          },
          {
            id: 42,
            number: 13,
            title: 'A pull request',
            state: 'open',
            user: { login: 'paul', avatar_url: null },
            assignees: [],
            labels: [],
            comments: 0,
            html_url: 'https://github.com/paul/bridge/pull/13',
            created_at: '2026-08-02T10:00:00Z',
            updated_at: '2026-08-05T11:00:00Z',
            pull_request: {},
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      github.listIssues('github_pat_secret', 'paul/bridge'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: '41',
        number: 12,
        state: 'open',
        labels: ['enhancement'],
        commentCount: 3,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/paul/bridge/issues?state=all&sort=updated&direction=desc&per_page=20',
      expect.any(Object),
    );
  });

  it('loads an issue body and its discussion', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 41,
            number: 12,
            title: 'Add the issues panel',
            body: '## Context\n\nIssue content.',
            state: 'open',
            user: { login: 'paul', avatar_url: null },
            assignees: [],
            labels: [{ name: 'enhancement' }],
            comments: 1,
            html_url: 'https://github.com/paul/bridge/issues/12',
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
              id: 51,
              user: { login: 'codex', avatar_url: null },
              body: 'Looks good.',
              html_url:
                'https://github.com/paul/bridge/issues/12#issuecomment-51',
              created_at: '2026-08-05T11:00:00Z',
              updated_at: '2026-08-05T11:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const detail = await github.getIssue(
      'github_pat_secret',
      'paul/bridge',
      12,
    );

    expect(detail.body).toBe('## Context\n\nIssue content.');
    expect(detail.comments).toHaveLength(1);
    expect(detail.comments[0]).toMatchObject({
      id: '51',
      author: { username: 'codex', avatarUrl: null },
    });
  });

  it('lists pull requests with their combined commit status', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 71,
              number: 8,
              title: 'Add project operations',
              body: 'Operational view.',
              state: 'open',
              draft: false,
              merged_at: null,
              user: { login: 'paul', avatar_url: null },
              requested_reviewers: [{ login: 'codex', avatar_url: null }],
              labels: [{ name: 'feature' }],
              head: { ref: 'feature/operations', sha: '1234567890abcdef' },
              base: { ref: 'develop' },
              html_url: 'https://github.com/paul/bridge/pull/8',
              created_at: '2026-08-05T10:00:00Z',
              updated_at: '2026-08-05T11:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: 'success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(
      github.listPullRequests('github_pat_secret', 'paul/bridge'),
    ).resolves.toEqual([
      expect.objectContaining({
        number: 8,
        pipelineStatus: 'success',
        sourceBranch: 'feature/operations',
        targetBranch: 'develop',
      }),
    ]);
  });

  it('groups GitHub deployments by environment', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 91,
              environment: 'production',
              ref: 'main',
              sha: '1234567890abcdef',
              created_at: '2026-08-05T10:00:00Z',
              updated_at: '2026-08-05T10:01:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 92,
              state: 'success',
              environment_url: 'https://bridge.example.com',
              target_url: null,
              created_at: '2026-08-05T10:01:00Z',
              updated_at: '2026-08-05T10:02:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(
      github.listEnvironments('github_pat_secret', 'paul/bridge'),
    ).resolves.toEqual([
      expect.objectContaining({
        name: 'production',
        state: 'success',
        url: 'https://bridge.example.com',
        shortSha: '12345678',
      }),
    ]);
  });

  it('creates a private initialized repository', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 123,
          name: 'the-bridge',
          full_name: 'pauldosser/the-bridge',
          description: null,
          html_url: 'https://github.com/pauldosser/the-bridge',
          clone_url: 'https://github.com/pauldosser/the-bridge.git',
          private: true,
          default_branch: 'main',
          updated_at: '2026-08-05T12:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await github.createRepository('github_pat_secret', 'connection-id', {
      name: 'the-bridge',
      visibility: 'private',
      initializeReadme: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/user/repos',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'the-bridge',
          private: true,
          auto_init: true,
        }),
      }),
    );
  });
});

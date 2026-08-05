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

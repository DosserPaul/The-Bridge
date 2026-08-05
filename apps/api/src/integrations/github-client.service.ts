import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  CreateRemoteRepositoryInput,
  NormalizedPipeline,
  PipelineStatus,
  RemoteRepositoryView,
} from './integrations.types';

const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

interface GitHubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  private: boolean;
  default_branch: string | null;
  updated_at: string;
}

interface GitHubWorkflowRunResponse {
  id: number;
  run_number: number;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface GitHubWorkflowRunsResponse {
  workflow_runs: GitHubWorkflowRunResponse[];
}

export interface GitHubAccount {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

function normalizeWorkflowRunStatus(
  status: string,
  conclusion: string | null,
): PipelineStatus {
  if (status === 'in_progress') return 'running';
  if (
    status === 'queued' ||
    status === 'requested' ||
    status === 'waiting' ||
    status === 'pending'
  ) {
    return 'pending';
  }

  if (conclusion === 'success') return 'success';
  if (
    conclusion === 'failure' ||
    conclusion === 'timed_out' ||
    conclusion === 'action_required' ||
    conclusion === 'startup_failure'
  ) {
    return 'failed';
  }
  if (conclusion === 'cancelled') return 'canceled';
  if (conclusion === 'skipped') return 'skipped';

  return 'unknown';
}

@Injectable()
export class GitHubClientService {
  async validateConnection(token: string): Promise<GitHubAccount> {
    const user = await this.request<GitHubUserResponse>(token, '/user');
    return {
      id: String(user.id),
      username: user.login,
      name: user.name?.trim() || user.login,
      avatarUrl: user.avatar_url,
    };
  }

  async listRepositories(
    token: string,
    connectionId: string,
  ): Promise<RemoteRepositoryView[]> {
    const repositories = await this.request<GitHubRepositoryResponse[]>(
      token,
      '/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&direction=desc&per_page=100',
    );
    return repositories.map((repository) =>
      this.toRepositoryView(repository, connectionId),
    );
  }

  async getRepository(
    token: string,
    connectionId: string,
    repositoryId: string,
  ): Promise<RemoteRepositoryView> {
    const repository = await this.request<GitHubRepositoryResponse>(
      token,
      `/repositories/${encodeURIComponent(repositoryId)}`,
    );
    return this.toRepositoryView(repository, connectionId);
  }

  async listWorkflowRuns(
    token: string,
    repositoryPath: string,
  ): Promise<NormalizedPipeline[]> {
    const runs = await this.request<GitHubWorkflowRunsResponse>(
      token,
      `/repos/${repositoryPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}/actions/runs?per_page=5`,
    );

    return runs.workflow_runs.map((run) => ({
      id: String(run.id),
      number: run.run_number,
      status: normalizeWorkflowRunStatus(run.status, run.conclusion),
      ref: run.head_branch ?? '—',
      sha: run.head_sha,
      shortSha: run.head_sha.slice(0, 8),
      webUrl: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    }));
  }

  async createRepository(
    token: string,
    connectionId: string,
    input: CreateRemoteRepositoryInput,
  ): Promise<RemoteRepositoryView> {
    const repository = await this.request<GitHubRepositoryResponse>(
      token,
      '/user/repos',
      {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          private: input.visibility === 'private',
          auto_init: input.initializeReadme,
        }),
      },
    );
    return this.toRepositoryView(repository, connectionId);
  }

  private toRepositoryView(
    repository: GitHubRepositoryResponse,
    connectionId: string,
  ): RemoteRepositoryView {
    return {
      id: String(repository.id),
      provider: 'github',
      connectionId,
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description,
      webUrl: repository.html_url,
      cloneUrl: repository.clone_url,
      visibility: repository.private ? 'private' : 'public',
      defaultBranch: repository.default_branch,
      updatedAt: repository.updated_at,
    };
  }

  private async request<T>(
    token: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${GITHUB_API_URL}${path}`, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'THE-BRIDGE',
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          ...init.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Impossible de joindre GitHub.');
    }

    const payload = (await response.json().catch(() => null)) as
      { message?: string } | T | null;

    if (response.status === 401) {
      throw new UnauthorizedException(
        'GitHub a refusé ce token. Vérifiez sa valeur ou sa date d’expiration.',
      );
    }

    if (response.status === 403) {
      const providerMessage = (payload as { message?: string } | null)?.message;
      const guidance = path.includes('/actions/runs')
        ? 'La permission Actions (lecture) est requise pour lire les exécutions.'
        : path === '/user/repos'
          ? 'La permission Administration (écriture) est requise pour créer un repository.'
          : 'Vérifiez les permissions du token.';
      throw new ForbiddenException(
        providerMessage
          ? `${providerMessage} ${guidance}`
          : `GitHub a refusé cette opération. ${guidance}`,
      );
    }

    if (response.status === 404 && path.includes('/actions/runs')) {
      const repositoryPath = path.match(
        /^\/repos\/([^?]+)\/actions\/runs/,
      )?.[1];
      throw new NotFoundException(
        `GitHub ne permet pas d’accéder à ce repository. Ajoutez ${repositoryPath ?? 'ce repository'} aux repositories autorisés du token et accordez la permission Actions (lecture), puis reconnectez GitHub.`,
      );
    }

    if (response.status === 422) {
      throw new BadRequestException(
        (payload as { message?: string } | null)?.message ??
          'GitHub a refusé les paramètres du repository.',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        (payload as { message?: string } | null)?.message ??
          `GitHub a répondu avec le statut ${response.status}.`,
      );
    }

    return payload as T;
  }
}

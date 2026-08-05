import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { NormalizedPipeline, PipelineStatus } from './integrations.types';
import type {
  CreateRemoteRepositoryInput,
  RemoteRepositoryView,
} from './integrations.types';

interface GitLabUserResponse {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
}

interface GitLabPipelineResponse {
  id: number;
  iid?: number;
  status: string;
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
}

interface GitLabRepositoryResponse {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  http_url_to_repo: string;
  visibility: 'private' | 'internal' | 'public';
  default_branch: string | null;
  last_activity_at: string;
}

export interface GitLabAccount {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

function normalizePipelineStatus(status: string): PipelineStatus {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'running') return 'running';
  if (status === 'canceled') return 'canceled';
  if (status === 'skipped') return 'skipped';
  if (status === 'manual') return 'manual';
  if (
    status === 'created' ||
    status === 'waiting_for_resource' ||
    status === 'preparing' ||
    status === 'pending' ||
    status === 'scheduled'
  ) {
    return 'pending';
  }

  return 'unknown';
}

export function normalizeGitLabBaseUrl(input: string): string {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new BadRequestException('URL GitLab invalide.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestException('L’URL GitLab doit utiliser HTTP ou HTTPS.');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new BadRequestException(
      'L’URL GitLab ne doit contenir ni identifiants, ni paramètres.',
    );
  }

  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

@Injectable()
export class GitLabClientService {
  async validateConnection(
    baseUrl: string,
    token: string,
  ): Promise<GitLabAccount> {
    const user = await this.request<GitLabUserResponse>(
      baseUrl,
      token,
      '/api/v4/user',
    );

    return {
      id: String(user.id),
      username: user.username,
      name: user.name,
      avatarUrl: user.avatar_url,
    };
  }

  async listPipelines(
    baseUrl: string,
    token: string,
    projectPath: string,
  ): Promise<NormalizedPipeline[]> {
    const encodedProjectPath = encodeURIComponent(projectPath);
    const pipelines = await this.request<GitLabPipelineResponse[]>(
      baseUrl,
      token,
      `/api/v4/projects/${encodedProjectPath}/pipelines?per_page=5&order_by=updated_at&sort=desc`,
    );

    return pipelines.map((pipeline) => ({
      id: String(pipeline.id),
      number: pipeline.iid ?? pipeline.id,
      status: normalizePipelineStatus(pipeline.status),
      ref: pipeline.ref,
      sha: pipeline.sha,
      shortSha: pipeline.sha.slice(0, 8),
      webUrl: pipeline.web_url,
      createdAt: pipeline.created_at,
      updatedAt: pipeline.updated_at,
    }));
  }

  async listRepositories(
    baseUrl: string,
    token: string,
    connectionId: string,
  ): Promise<RemoteRepositoryView[]> {
    const repositories = await this.request<GitLabRepositoryResponse[]>(
      baseUrl,
      token,
      '/api/v4/projects?membership=true&simple=true&active=true&order_by=last_activity_at&sort=desc&per_page=100',
    );
    return repositories.map((repository) =>
      this.toRepositoryView(repository, connectionId),
    );
  }

  async getRepository(
    baseUrl: string,
    token: string,
    connectionId: string,
    repositoryId: string,
  ): Promise<RemoteRepositoryView> {
    const repository = await this.request<GitLabRepositoryResponse>(
      baseUrl,
      token,
      `/api/v4/projects/${encodeURIComponent(repositoryId)}`,
    );
    return this.toRepositoryView(repository, connectionId);
  }

  async createRepository(
    baseUrl: string,
    token: string,
    connectionId: string,
    input: CreateRemoteRepositoryInput,
  ): Promise<RemoteRepositoryView> {
    const repository = await this.request<GitLabRepositoryResponse>(
      baseUrl,
      token,
      '/api/v4/projects',
      {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          visibility: input.visibility,
          initialize_with_readme: input.initializeReadme,
        }),
      },
    );
    return this.toRepositoryView(repository, connectionId);
  }

  private toRepositoryView(
    repository: GitLabRepositoryResponse,
    connectionId: string,
  ): RemoteRepositoryView {
    return {
      id: String(repository.id),
      provider: 'gitlab',
      connectionId,
      name: repository.name,
      fullName: repository.path_with_namespace,
      description: repository.description,
      webUrl: repository.web_url,
      cloneUrl: repository.http_url_to_repo,
      visibility: repository.visibility,
      defaultBranch: repository.default_branch,
      updatedAt: repository.last_activity_at,
    };
  }

  private async request<T>(
    baseUrl: string,
    token: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': token,
          ...init.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException(
        'Impossible de joindre cette instance GitLab.',
      );
    }

    if (response.status === 401) {
      throw new UnauthorizedException(
        'GitLab a refusé ce token. Vérifiez sa valeur et ses scopes.',
      );
    }

    if (response.status === 403) {
      throw new ForbiddenException(
        'GitLab a refusé cette opération. Le scope api est requis pour créer un repository.',
      );
    }

    if (response.status === 400 || response.status === 409) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string | Record<string, string[]>;
      } | null;
      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : 'GitLab a refusé les paramètres du repository.';
      throw new BadRequestException(message);
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new BadGatewayException(
        payload?.message ??
          `GitLab a répondu avec le statut ${response.status}.`,
      );
    }

    return response.json() as Promise<T>;
  }
}

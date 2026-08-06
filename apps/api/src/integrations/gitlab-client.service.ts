import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ChangeStatus,
  DeploymentState,
  NormalizedEnvironment,
  NormalizedIssue,
  NormalizedIssueDetail,
  NormalizedPipeline,
  NormalizedPullRequest,
  PipelineStatus,
} from './integrations.types';
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

interface GitLabIssueUserResponse {
  username: string;
  avatar_url: string | null;
}

interface GitLabIssueResponse {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: 'opened' | 'closed';
  author: GitLabIssueUserResponse;
  assignees: GitLabIssueUserResponse[];
  labels: string[];
  user_notes_count: number;
  web_url: string;
  created_at: string;
  updated_at: string;
}

interface GitLabIssueNoteResponse {
  id: number;
  author: GitLabIssueUserResponse;
  body: string;
  system: boolean;
  created_at: string;
  updated_at: string;
}

interface GitLabMergeRequestResponse {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: 'opened' | 'closed' | 'merged';
  draft?: boolean;
  work_in_progress?: boolean;
  author: GitLabIssueUserResponse;
  reviewers: GitLabIssueUserResponse[];
  labels: string[];
  source_branch: string;
  target_branch: string;
  sha: string;
  merge_status: string;
  detailed_merge_status?: string;
  has_conflicts: boolean;
  head_pipeline?: { status: string } | null;
  web_url: string;
  created_at: string;
  updated_at: string;
}

interface GitLabEnvironmentResponse {
  id: number;
  name: string;
  state: 'available' | 'stopped';
  external_url: string | null;
  updated_at: string;
  last_deployment?: {
    id: number;
    status: string;
    ref: string;
    sha: string;
    created_at: string;
    updated_at: string;
  } | null;
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

function normalizeGitLabChangeStatus(status: string | undefined): ChangeStatus {
  if (!status) return 'unknown';
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'running') return 'running';
  if (status === 'canceled' || status === 'skipped') return 'canceled';
  if (
    status === 'created' ||
    status === 'waiting_for_resource' ||
    status === 'preparing' ||
    status === 'pending' ||
    status === 'scheduled' ||
    status === 'manual'
  ) {
    return 'pending';
  }
  return 'unknown';
}

function normalizeGitLabDeploymentState(
  environment: GitLabEnvironmentResponse,
): DeploymentState {
  if (environment.state === 'stopped') return 'inactive';
  const status = environment.last_deployment?.status;
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'running') return 'running';
  if (status === 'pending' || status === 'created') return 'pending';
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

  async listIssues(
    baseUrl: string,
    token: string,
    projectPath: string,
  ): Promise<NormalizedIssue[]> {
    const issues = await this.request<GitLabIssueResponse[]>(
      baseUrl,
      token,
      `/api/v4/projects/${encodeURIComponent(projectPath)}/issues?scope=all&state=all&order_by=updated_at&sort=desc&per_page=20`,
    );

    return issues.map((issue) => this.toIssue(issue));
  }

  async getIssue(
    baseUrl: string,
    token: string,
    projectPath: string,
    issueNumber: number,
  ): Promise<NormalizedIssueDetail> {
    const issuePath = `/api/v4/projects/${encodeURIComponent(projectPath)}/issues/${issueNumber}`;
    const [issue, notes] = await Promise.all([
      this.request<GitLabIssueResponse>(baseUrl, token, issuePath),
      this.request<GitLabIssueNoteResponse[]>(
        baseUrl,
        token,
        `${issuePath}/notes?sort=asc&per_page=50`,
      ),
    ]);

    return {
      ...this.toIssue(issue),
      body: issue.description,
      comments: notes
        .filter((note) => !note.system)
        .map((note) => ({
          id: String(note.id),
          author: {
            username: note.author.username,
            avatarUrl: note.author.avatar_url,
          },
          body: note.body,
          createdAt: note.created_at,
          updatedAt: note.updated_at,
          webUrl: null,
        })),
    };
  }

  async listPullRequests(
    baseUrl: string,
    token: string,
    projectPath: string,
  ): Promise<NormalizedPullRequest[]> {
    const mergeRequests = await this.request<GitLabMergeRequestResponse[]>(
      baseUrl,
      token,
      `/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests?scope=all&state=all&order_by=updated_at&sort=desc&per_page=20`,
    );
    return mergeRequests.map((mergeRequest) =>
      this.toPullRequest(mergeRequest),
    );
  }

  async getPullRequest(
    baseUrl: string,
    token: string,
    projectPath: string,
    pullRequestNumber: number,
  ): Promise<NormalizedPullRequest> {
    const mergeRequest = await this.request<GitLabMergeRequestResponse>(
      baseUrl,
      token,
      `/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests/${pullRequestNumber}`,
    );
    return this.toPullRequest(mergeRequest);
  }

  async listEnvironments(
    baseUrl: string,
    token: string,
    projectPath: string,
  ): Promise<NormalizedEnvironment[]> {
    const environments = await this.request<GitLabEnvironmentResponse[]>(
      baseUrl,
      token,
      `/api/v4/projects/${encodeURIComponent(projectPath)}/environments?per_page=20`,
    );
    return environments.map((environment) => ({
      id: String(environment.id),
      name: environment.name,
      state: normalizeGitLabDeploymentState(environment),
      url: environment.external_url,
      ref: environment.last_deployment?.ref ?? null,
      sha: environment.last_deployment?.sha ?? null,
      shortSha: environment.last_deployment?.sha.slice(0, 8) ?? null,
      deploymentId: environment.last_deployment
        ? String(environment.last_deployment.id)
        : null,
      createdAt: environment.last_deployment?.created_at ?? null,
      updatedAt:
        environment.last_deployment?.updated_at ?? environment.updated_at,
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

  private toIssue(issue: GitLabIssueResponse): NormalizedIssue {
    return {
      id: String(issue.id),
      number: issue.iid,
      title: issue.title,
      state: issue.state === 'opened' ? 'open' : 'closed',
      author: {
        username: issue.author.username,
        avatarUrl: issue.author.avatar_url,
      },
      assignees: issue.assignees.map((assignee) => ({
        username: assignee.username,
        avatarUrl: assignee.avatar_url,
      })),
      labels: issue.labels,
      commentCount: issue.user_notes_count,
      webUrl: issue.web_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    };
  }

  private toPullRequest(
    mergeRequest: GitLabMergeRequestResponse,
  ): NormalizedPullRequest {
    const draft = mergeRequest.draft ?? mergeRequest.work_in_progress ?? false;
    const mergeable =
      mergeRequest.state !== 'opened'
        ? null
        : !mergeRequest.has_conflicts &&
          !['cannot_be_merged', 'conflict'].includes(mergeRequest.merge_status);
    return {
      id: String(mergeRequest.id),
      number: mergeRequest.iid,
      title: mergeRequest.title,
      description: mergeRequest.description,
      state:
        mergeRequest.state === 'merged'
          ? 'merged'
          : draft
            ? 'draft'
            : mergeRequest.state === 'opened'
              ? 'open'
              : 'closed',
      author: {
        username: mergeRequest.author.username,
        avatarUrl: mergeRequest.author.avatar_url,
      },
      reviewers: mergeRequest.reviewers.map((reviewer) => ({
        username: reviewer.username,
        avatarUrl: reviewer.avatar_url,
      })),
      labels: mergeRequest.labels,
      sourceBranch: mergeRequest.source_branch,
      targetBranch: mergeRequest.target_branch,
      sha: mergeRequest.sha,
      shortSha: mergeRequest.sha.slice(0, 8),
      pipelineStatus: normalizeGitLabChangeStatus(
        mergeRequest.head_pipeline?.status,
      ),
      mergeable,
      hasConflicts: mergeRequest.has_conflicts,
      webUrl: mergeRequest.web_url,
      createdAt: mergeRequest.created_at,
      updatedAt: mergeRequest.updated_at,
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

import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ChangeStatus,
  CreateRemoteRepositoryInput,
  DeploymentState,
  NormalizedEnvironment,
  NormalizedIssue,
  NormalizedIssueDetail,
  NormalizedPipeline,
  NormalizedPullRequest,
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

interface GitHubIssueUserResponse {
  login: string;
  avatar_url: string | null;
}

interface GitHubIssueResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: GitHubIssueUserResponse | null;
  assignees: GitHubIssueUserResponse[];
  labels: Array<{ name: string | null }>;
  comments: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

interface GitHubIssueCommentResponse {
  id: number;
  user: GitHubIssueUserResponse | null;
  body: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface GitHubPullRequestResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  draft: boolean;
  merged_at: string | null;
  mergeable?: boolean | null;
  mergeable_state?: string;
  user: GitHubIssueUserResponse | null;
  requested_reviewers: GitHubIssueUserResponse[];
  labels: Array<{ name: string | null }>;
  head: { ref: string; sha: string };
  base: { ref: string };
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface GitHubCommitStatusResponse {
  state: 'error' | 'failure' | 'pending' | 'success';
}

interface GitHubDeploymentResponse {
  id: number;
  environment: string;
  ref: string;
  sha: string;
  created_at: string;
  updated_at: string;
}

interface GitHubDeploymentStatusResponse {
  id: number;
  state:
    | 'error'
    | 'failure'
    | 'inactive'
    | 'in_progress'
    | 'pending'
    | 'queued'
    | 'success';
  environment_url: string | null;
  target_url: string | null;
  created_at: string;
  updated_at: string;
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

function normalizeGitHubChangeStatus(
  state: GitHubCommitStatusResponse['state'],
): ChangeStatus {
  if (state === 'success') return 'success';
  if (state === 'failure' || state === 'error') return 'failed';
  if (state === 'pending') return 'pending';
  return 'unknown';
}

function normalizeGitHubDeploymentState(
  state: GitHubDeploymentStatusResponse['state'] | undefined,
): DeploymentState {
  if (state === 'success') return 'success';
  if (state === 'failure' || state === 'error') return 'failed';
  if (state === 'in_progress') return 'running';
  if (state === 'pending' || state === 'queued') return 'pending';
  if (state === 'inactive') return 'inactive';
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

  async listIssues(
    token: string,
    repositoryPath: string,
  ): Promise<NormalizedIssue[]> {
    const issues = await this.request<GitHubIssueResponse[]>(
      token,
      `/repos/${repositoryPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}/issues?state=all&sort=updated&direction=desc&per_page=20`,
    );

    return issues
      .filter((issue) => !issue.pull_request)
      .map((issue) => this.toIssue(issue));
  }

  async getIssue(
    token: string,
    repositoryPath: string,
    issueNumber: number,
  ): Promise<NormalizedIssueDetail> {
    const encodedPath = repositoryPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const [issue, comments] = await Promise.all([
      this.request<GitHubIssueResponse>(
        token,
        `/repos/${encodedPath}/issues/${issueNumber}`,
      ),
      this.request<GitHubIssueCommentResponse[]>(
        token,
        `/repos/${encodedPath}/issues/${issueNumber}/comments?per_page=50`,
      ),
    ]);

    if (issue.pull_request) {
      throw new NotFoundException('Cette ressource est une pull request.');
    }

    return {
      ...this.toIssue(issue),
      body: issue.body,
      comments: comments.map((comment) => ({
        id: String(comment.id),
        author: {
          username: comment.user?.login ?? 'ghost',
          avatarUrl: comment.user?.avatar_url ?? null,
        },
        body: comment.body,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        webUrl: comment.html_url,
      })),
    };
  }

  async listPullRequests(
    token: string,
    repositoryPath: string,
  ): Promise<NormalizedPullRequest[]> {
    const encodedPath = this.encodeRepositoryPath(repositoryPath);
    const pullRequests = await this.request<GitHubPullRequestResponse[]>(
      token,
      `/repos/${encodedPath}/pulls?state=all&sort=updated&direction=desc&per_page=20`,
    );

    return Promise.all(
      pullRequests.map(async (pullRequest) => {
        const status = await this.request<GitHubCommitStatusResponse>(
          token,
          `/repos/${encodedPath}/commits/${pullRequest.head.sha}/status`,
        ).catch(() => null);
        return this.toPullRequest(
          pullRequest,
          status ? normalizeGitHubChangeStatus(status.state) : 'unknown',
        );
      }),
    );
  }

  async getPullRequest(
    token: string,
    repositoryPath: string,
    pullRequestNumber: number,
  ): Promise<NormalizedPullRequest> {
    const encodedPath = this.encodeRepositoryPath(repositoryPath);
    const pullRequest = await this.request<GitHubPullRequestResponse>(
      token,
      `/repos/${encodedPath}/pulls/${pullRequestNumber}`,
    );
    const status = await this.request<GitHubCommitStatusResponse>(
      token,
      `/repos/${encodedPath}/commits/${pullRequest.head.sha}/status`,
    ).catch(() => null);
    return this.toPullRequest(
      pullRequest,
      status ? normalizeGitHubChangeStatus(status.state) : 'unknown',
    );
  }

  async listEnvironments(
    token: string,
    repositoryPath: string,
  ): Promise<NormalizedEnvironment[]> {
    const encodedPath = this.encodeRepositoryPath(repositoryPath);
    const deployments = await this.request<GitHubDeploymentResponse[]>(
      token,
      `/repos/${encodedPath}/deployments?per_page=20`,
    );
    const latestByEnvironment = deployments.filter(
      (deployment, index, all) =>
        all.findIndex(
          (candidate) => candidate.environment === deployment.environment,
        ) === index,
    );

    return Promise.all(
      latestByEnvironment.map(async (deployment) => {
        const statuses = await this.request<GitHubDeploymentStatusResponse[]>(
          token,
          `/repos/${encodedPath}/deployments/${deployment.id}/statuses?per_page=1`,
        ).catch(() => []);
        const status = statuses[0];
        return {
          id: `${deployment.environment}:${deployment.id}`,
          name: deployment.environment || 'default',
          state: normalizeGitHubDeploymentState(status?.state),
          url: status?.environment_url ?? status?.target_url ?? null,
          ref: deployment.ref,
          sha: deployment.sha,
          shortSha: deployment.sha.slice(0, 8),
          deploymentId: String(deployment.id),
          createdAt: deployment.created_at,
          updatedAt: status?.updated_at ?? deployment.updated_at,
        } satisfies NormalizedEnvironment;
      }),
    );
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

  private toIssue(issue: GitHubIssueResponse): NormalizedIssue {
    return {
      id: String(issue.id),
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: {
        username: issue.user?.login ?? 'ghost',
        avatarUrl: issue.user?.avatar_url ?? null,
      },
      assignees: issue.assignees.map((assignee) => ({
        username: assignee.login,
        avatarUrl: assignee.avatar_url,
      })),
      labels: issue.labels
        .map((label) => label.name?.trim())
        .filter((label): label is string => Boolean(label)),
      commentCount: issue.comments,
      webUrl: issue.html_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    };
  }

  private toPullRequest(
    pullRequest: GitHubPullRequestResponse,
    pipelineStatus: ChangeStatus,
  ): NormalizedPullRequest {
    return {
      id: String(pullRequest.id),
      number: pullRequest.number,
      title: pullRequest.title,
      description: pullRequest.body,
      state: pullRequest.merged_at
        ? 'merged'
        : pullRequest.draft
          ? 'draft'
          : pullRequest.state,
      author: {
        username: pullRequest.user?.login ?? 'ghost',
        avatarUrl: pullRequest.user?.avatar_url ?? null,
      },
      reviewers: pullRequest.requested_reviewers.map((reviewer) => ({
        username: reviewer.login,
        avatarUrl: reviewer.avatar_url,
      })),
      labels: pullRequest.labels
        .map((label) => label.name?.trim())
        .filter((label): label is string => Boolean(label)),
      sourceBranch: pullRequest.head.ref,
      targetBranch: pullRequest.base.ref,
      sha: pullRequest.head.sha,
      shortSha: pullRequest.head.sha.slice(0, 8),
      pipelineStatus,
      mergeable: pullRequest.mergeable ?? null,
      hasConflicts:
        pullRequest.mergeable === false ||
        pullRequest.mergeable_state === 'dirty'
          ? true
          : pullRequest.mergeable === true
            ? false
            : null,
      webUrl: pullRequest.html_url,
      createdAt: pullRequest.created_at,
      updatedAt: pullRequest.updated_at,
    };
  }

  private encodeRepositoryPath(repositoryPath: string): string {
    return repositoryPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
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
        : path.includes('/issues')
          ? 'La permission Issues (lecture) est requise pour lire les issues.'
          : path === '/user/repos'
            ? 'La permission Administration (écriture) est requise pour créer un repository.'
            : 'Vérifiez les permissions du token.';
      throw new ForbiddenException(
        providerMessage
          ? `${providerMessage} ${guidance}`
          : `GitHub a refusé cette opération. ${guidance}`,
      );
    }

    if (
      response.status === 404 &&
      (path.includes('/actions/runs') || path.includes('/issues'))
    ) {
      const repositoryPath = path.match(
        /^\/repos\/([^?]+)\/(?:actions\/runs|issues)/,
      )?.[1];
      const permission = path.includes('/issues') ? 'Issues' : 'Actions';
      throw new NotFoundException(
        `GitHub ne permet pas d’accéder à ce repository. Ajoutez ${repositoryPath ?? 'ce repository'} aux repositories autorisés du token et accordez la permission ${permission} (lecture), puis reconnectez GitHub.`,
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

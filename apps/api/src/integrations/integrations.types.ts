export interface GitLabConnectionView {
  id: string;
  provider: 'gitlab';
  baseUrl: string;
  account: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
  };
  credentialState: 'available' | 'missing';
  createdAt: string;
  updatedAt: string;
}

export interface GitHubConnectionView {
  id: string;
  provider: 'github';
  baseUrl: string;
  account: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
  };
  credentialState: 'available' | 'missing';
  createdAt: string;
  updatedAt: string;
}

export interface RemoteRepositoryView {
  id: string;
  provider: 'github' | 'gitlab';
  connectionId: string;
  name: string;
  fullName: string;
  description: string | null;
  webUrl: string;
  cloneUrl: string;
  visibility: 'private' | 'public' | 'internal';
  defaultBranch: string | null;
  updatedAt: string;
}

export interface CreateRemoteRepositoryInput {
  name: string;
  description?: string;
  visibility: 'private' | 'public';
  initializeReadme: boolean;
}

export type PipelineStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'skipped'
  | 'manual'
  | 'unknown';

export interface NormalizedPipeline {
  id: string;
  number: number;
  status: PipelineStatus;
  ref: string;
  sha: string;
  shortSha: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryPipelinesView {
  repositoryId: string;
  repositoryName: string;
  provider: 'github' | 'gitlab' | 'unknown';
  state: 'ready' | 'connection_required' | 'unsupported' | 'error';
  message?: string;
  pipelines: NormalizedPipeline[];
}

export interface ProjectPipelinesView {
  projectId: string;
  repositories: RepositoryPipelinesView[];
}

export interface NormalizedIssue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: {
    username: string;
    avatarUrl: string | null;
  };
  assignees: Array<{
    username: string;
    avatarUrl: string | null;
  }>;
  labels: string[];
  commentCount: number;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedIssueComment {
  id: string;
  author: {
    username: string;
    avatarUrl: string | null;
  };
  body: string;
  createdAt: string;
  updatedAt: string;
  webUrl: string | null;
}

export interface NormalizedIssueDetail extends NormalizedIssue {
  body: string | null;
  comments: NormalizedIssueComment[];
}

export interface RepositoryIssuesView {
  repositoryId: string;
  repositoryName: string;
  provider: 'github' | 'gitlab' | 'unknown';
  state: 'ready' | 'connection_required' | 'unsupported' | 'error';
  message?: string;
  issues: NormalizedIssue[];
}

export interface ProjectIssuesView {
  projectId: string;
  repositories: RepositoryIssuesView[];
}

export interface ProjectIssueDetailView {
  projectId: string;
  repositoryId: string;
  repositoryName: string;
  provider: 'github' | 'gitlab';
  issue: NormalizedIssueDetail;
}

export type PullRequestState = 'open' | 'closed' | 'merged' | 'draft';
export type ChangeStatus =
  'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'unknown';

export interface NormalizedPullRequest {
  id: string;
  number: number;
  title: string;
  description: string | null;
  state: PullRequestState;
  author: {
    username: string;
    avatarUrl: string | null;
  };
  reviewers: Array<{
    username: string;
    avatarUrl: string | null;
  }>;
  labels: string[];
  sourceBranch: string;
  targetBranch: string;
  sha: string;
  shortSha: string;
  pipelineStatus: ChangeStatus;
  mergeable: boolean | null;
  hasConflicts: boolean | null;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryPullRequestsView {
  repositoryId: string;
  repositoryName: string;
  provider: 'github' | 'gitlab' | 'unknown';
  state: 'ready' | 'connection_required' | 'unsupported' | 'error';
  message?: string;
  pullRequests: NormalizedPullRequest[];
}

export interface ProjectPullRequestsView {
  projectId: string;
  repositories: RepositoryPullRequestsView[];
}

export interface ProjectPullRequestDetailView {
  projectId: string;
  repositoryId: string;
  repositoryName: string;
  provider: 'github' | 'gitlab';
  pullRequest: NormalizedPullRequest;
}

export type DeploymentState =
  'success' | 'failed' | 'running' | 'pending' | 'inactive' | 'unknown';

export interface NormalizedEnvironment {
  id: string;
  name: string;
  state: DeploymentState;
  url: string | null;
  ref: string | null;
  sha: string | null;
  shortSha: string | null;
  deploymentId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RepositoryEnvironmentsView {
  repositoryId: string;
  repositoryName: string;
  provider: 'github' | 'gitlab' | 'unknown';
  state: 'ready' | 'connection_required' | 'unsupported' | 'error';
  message?: string;
  environments: NormalizedEnvironment[];
}

export interface ProjectEnvironmentsView {
  projectId: string;
  repositories: RepositoryEnvironmentsView[];
}

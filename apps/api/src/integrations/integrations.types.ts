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

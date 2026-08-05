import type { RepositoryProvider, RepositoryState } from './git.service';

export interface ClientSummary {
  id: string;
  name: string;
}

export interface RepositoryView {
  id: string;
  name: string;
  localPath: string;
  remoteUrl: string | null;
  provider: RepositoryProvider;
  state: RepositoryState;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectView {
  id: string;
  name: string;
  logoDataUrl: string | null;
  description: string | null;
  status: 'planned' | 'active' | 'paused' | 'completed' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'critical';
  types: string[];
  technologies: string[];
  startDate: string | null;
  deadline: string | null;
  followUp: {
    date: string;
    note: string | null;
  } | null;
  client: ClientSummary | null;
  repositories: RepositoryView[];
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryPathValidation {
  repositoryMode: 'local' | 'existing' | 'create';
  resolvedPath: string;
  repository: {
    name: string;
    provider: RepositoryProvider;
    remoteUrl: string | null;
    branch: string | null;
  } | null;
}

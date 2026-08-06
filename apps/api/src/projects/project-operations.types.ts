export const localActionNames = [
  'editor',
  'terminal',
  'finder',
  'remote',
  'dev',
  'test',
  'lint',
  'build',
  'coverage',
  'audit',
  'outdated',
] as const;

export type LocalActionName = (typeof localActionNames)[number];
export type LocalActionStatus =
  'queued' | 'running' | 'succeeded' | 'failed' | 'stopped';

export interface LocalActionRun {
  id: string;
  projectId: string;
  repositoryId: string;
  repositoryName: string;
  action: LocalActionName;
  status: LocalActionStatus;
  commandLabel: string;
  output: string;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface BranchHealth {
  name: 'main' | 'develop';
  exists: boolean;
  lastCommitAt: string | null;
}

export interface RepositoryHealth {
  repositoryId: string;
  repositoryName: string;
  localPath: string;
  packageManager: string | null;
  dependencyCount: number | null;
  lockfile: string | null;
  lockfileUpdatedAt: string | null;
  coveragePercent: number | null;
  branches: BranchHealth[];
  latestRuns: Partial<Record<LocalActionName, LocalActionRun>>;
}

export interface ProjectHealth {
  repositories: RepositoryHealth[];
  latestBackupAt: string | null;
}

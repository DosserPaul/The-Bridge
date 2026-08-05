import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GitHubClientService } from './github-client.service';
import { GitLabClientService } from './gitlab-client.service';
import {
  IntegrationsService,
  type GitHubConnectionRecord,
  type GitLabConnectionRecord,
} from './integrations.service';
import type {
  ProjectPipelinesView,
  RepositoryPipelinesView,
} from './integrations.types';

interface RepositoryRow {
  id: string;
  name: string;
  remote_url: string | null;
  provider: 'github' | 'gitlab' | 'unknown';
}

export interface GitRemoteLocation {
  hostname: string;
  projectPath: string;
}

function safeDecodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export function parseGitRemote(remoteUrl: string): GitRemoteLocation | null {
  let hostname: string;
  let pathname: string;

  if (!remoteUrl.includes('://')) {
    const scpLocation = remoteUrl.match(/^(?:[^@]+@)?([^:/]+):(.+)$/);
    if (!scpLocation) return null;
    hostname = scpLocation[1];
    pathname = scpLocation[2];
  } else {
    try {
      const url = new URL(remoteUrl);
      hostname = url.hostname;
      pathname = url.pathname;
    } catch {
      return null;
    }
  }

  const projectPath = safeDecodePath(pathname)
    .replace(/^\/+/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');

  if (!hostname || !projectPath) return null;
  return { hostname: hostname.toLowerCase(), projectPath };
}

function connectionProjectPath(
  remote: GitRemoteLocation,
  connection: GitLabConnectionRecord,
): string {
  const connectionPath = new URL(connection.baseUrl).pathname
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  if (
    connectionPath &&
    remote.projectPath.toLowerCase().startsWith(`${connectionPath}/`)
  ) {
    return remote.projectPath.slice(connectionPath.length + 1);
  }

  return remote.projectPath;
}

@Injectable()
export class ProjectPipelinesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly integrations: IntegrationsService,
    private readonly gitlab: GitLabClientService,
    private readonly github: GitHubClientService,
  ) {}

  async findForProject(projectId: string): Promise<ProjectPipelinesView> {
    const project = this.database.connection
      .prepare('SELECT id FROM projects WHERE id = ?')
      .get(projectId) as { id: string } | undefined;

    if (!project) throw new NotFoundException('Projet introuvable.');

    const repositories = this.database.connection
      .prepare(
        `SELECT id, name, remote_url, provider
         FROM repositories
         WHERE project_id = ?
         ORDER BY created_at ASC`,
      )
      .all(projectId) as RepositoryRow[];
    const gitLabConnections = this.integrations.findAllGitLabRecords();
    const gitHubConnections = this.integrations.findAllGitHubRecords();

    return {
      projectId,
      repositories: await Promise.all(
        repositories.map((repository) =>
          this.findForRepository(
            repository,
            gitLabConnections,
            gitHubConnections,
          ),
        ),
      ),
    };
  }

  private async findForRepository(
    repository: RepositoryRow,
    gitLabConnections: GitLabConnectionRecord[],
    gitHubConnections: GitHubConnectionRecord[],
  ): Promise<RepositoryPipelinesView> {
    if (!repository.remote_url) {
      return this.emptyRepositoryView(
        repository,
        'unsupported',
        'Aucun remote origin n’est configuré.',
      );
    }

    const remote = parseGitRemote(repository.remote_url);
    if (!remote) {
      return this.emptyRepositoryView(
        repository,
        'unsupported',
        'Le remote origin n’a pas pu être interprété.',
      );
    }

    const provider = this.resolveProvider(repository.provider, remote.hostname);

    if (provider === 'github') {
      return this.findGitHubActions(repository, remote, gitHubConnections);
    }

    if (provider === 'gitlab') {
      return this.findGitLabPipelines(repository, remote, gitLabConnections);
    }

    return this.emptyRepositoryView(
      repository,
      'unsupported',
      'Le provider de ce remote origin n’est pas pris en charge.',
    );
  }

  private async findGitHubActions(
    repository: RepositoryRow,
    remote: GitRemoteLocation,
    connections: GitHubConnectionRecord[],
  ): Promise<RepositoryPipelinesView> {
    const connection = this.findConnection(remote, connections);

    if (!connection) {
      return this.emptyRepositoryView(
        repository,
        'connection_required',
        'Connectez GitHub pour lire les exécutions Actions.',
      );
    }

    try {
      const token = await this.integrations.readToken(connection);
      if (!token) {
        return this.emptyRepositoryView(
          repository,
          'connection_required',
          'Le token de cette connexion est absent du Trousseau macOS.',
        );
      }

      const pipelines = await this.github.listWorkflowRuns(
        token,
        remote.projectPath,
      );

      return {
        repositoryId: repository.id,
        repositoryName: repository.name,
        provider: 'github',
        state: 'ready',
        pipelines,
      };
    } catch (error) {
      return this.emptyRepositoryView(
        repository,
        this.isConnectionError(error) ? 'connection_required' : 'error',
        error instanceof Error
          ? error.message
          : 'Impossible de charger les exécutions GitHub Actions.',
      );
    }
  }

  private async findGitLabPipelines(
    repository: RepositoryRow,
    remote: GitRemoteLocation,
    connections: GitLabConnectionRecord[],
  ): Promise<RepositoryPipelinesView> {
    const connection = this.findConnection(remote, connections);

    if (!connection) {
      return this.emptyRepositoryView(
        repository,
        'connection_required',
        `Connectez ${remote.hostname} pour lire ses pipelines.`,
      );
    }

    try {
      const token = await this.integrations.readToken(connection);
      if (!token) {
        return this.emptyRepositoryView(
          repository,
          'connection_required',
          'Le token de cette connexion est absent du Trousseau macOS.',
        );
      }

      const pipelines = await this.gitlab.listPipelines(
        connection.baseUrl,
        token,
        connectionProjectPath(remote, connection),
      );

      return {
        repositoryId: repository.id,
        repositoryName: repository.name,
        provider: 'gitlab',
        state: 'ready',
        pipelines,
      };
    } catch (error) {
      return this.emptyRepositoryView(
        repository,
        'error',
        error instanceof Error
          ? error.message
          : 'Impossible de charger les pipelines GitLab.',
      );
    }
  }

  private findConnection<
    Connection extends GitHubConnectionRecord | GitLabConnectionRecord,
  >(
    remote: GitRemoteLocation,
    connections: Connection[],
  ): Connection | undefined {
    return connections.find(
      (candidate) =>
        new URL(candidate.baseUrl).hostname.toLowerCase() === remote.hostname,
    );
  }

  private resolveProvider(
    storedProvider: RepositoryRow['provider'],
    hostname: string,
  ): RepositoryRow['provider'] {
    if (storedProvider !== 'unknown') return storedProvider;
    if (hostname === 'github.com') return 'github';
    if (hostname.includes('gitlab')) return 'gitlab';
    return 'unknown';
  }

  private isConnectionError(error: unknown): boolean {
    return (
      error instanceof HttpException &&
      [401, 403, 404].includes(error.getStatus())
    );
  }

  private emptyRepositoryView(
    repository: RepositoryRow,
    state: RepositoryPipelinesView['state'],
    message: string,
  ): RepositoryPipelinesView {
    return {
      repositoryId: repository.id,
      repositoryName: repository.name,
      provider: repository.provider,
      state,
      message,
      pipelines: [],
    };
  }
}

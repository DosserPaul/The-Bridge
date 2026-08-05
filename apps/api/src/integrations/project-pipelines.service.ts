import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GitLabClientService } from './gitlab-client.service';
import {
  IntegrationsService,
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
    const connections = this.integrations.findAllGitLabRecords();

    return {
      projectId,
      repositories: await Promise.all(
        repositories.map((repository) =>
          this.findForRepository(repository, connections),
        ),
      ),
    };
  }

  private async findForRepository(
    repository: RepositoryRow,
    connections: GitLabConnectionRecord[],
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

    const connection = connections.find(
      (candidate) =>
        new URL(candidate.baseUrl).hostname.toLowerCase() === remote.hostname,
    );

    if (!connection) {
      const isGitLab =
        repository.provider === 'gitlab' || remote.hostname.includes('gitlab');
      return this.emptyRepositoryView(
        repository,
        isGitLab ? 'connection_required' : 'unsupported',
        isGitLab
          ? `Connectez ${remote.hostname} pour lire ses pipelines.`
          : 'Ce repository n’est pas hébergé sur une instance GitLab connectée.',
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

  private emptyRepositoryView(
    repository: RepositoryRow,
    state: RepositoryPipelinesView['state'],
    message: string,
  ): RepositoryPipelinesView {
    return {
      repositoryId: repository.id,
      repositoryName: repository.name,
      state,
      message,
      pipelines: [],
    };
  }
}

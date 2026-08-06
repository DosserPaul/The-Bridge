import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  detectProviderFromRemote,
  parseGitRemote,
  type GitRemoteLocation,
} from '../repositories/git-remote';
import {
  RepositoryCatalogService,
  type RepositoryRecord,
} from '../repositories/repository-catalog.service';
import { GitHubClientService } from './github-client.service';
import { GitLabClientService } from './gitlab-client.service';
import {
  IntegrationsService,
  type GitHubConnectionRecord,
  type GitLabConnectionRecord,
} from './integrations.service';
import type {
  ProjectIssuesView,
  ProjectIssueDetailView,
  RepositoryIssuesView,
} from './integrations.types';

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
export class ProjectIssuesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repositoryCatalog: RepositoryCatalogService,
    private readonly integrations: IntegrationsService,
    private readonly gitlab: GitLabClientService,
    private readonly github: GitHubClientService,
  ) {}

  async findForProject(projectId: string): Promise<ProjectIssuesView> {
    const project = await this.database
      .connection<{ id: string }>('projects')
      .select('id')
      .where({ id: projectId })
      .first();

    if (!project) throw new NotFoundException('Projet introuvable.');

    const repositories =
      await this.repositoryCatalog.refreshProjectRecords(projectId);
    const [gitLabConnections, gitHubConnections] = await Promise.all([
      this.integrations.findAllGitLabRecords(),
      this.integrations.findAllGitHubRecords(),
    ]);

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

  async findIssue(
    projectId: string,
    repositoryId: string,
    issueNumber: number,
  ): Promise<ProjectIssueDetailView> {
    const repository = await this.repositoryCatalog.getRecord(
      projectId,
      repositoryId,
    );
    if (!repository.remote_url) {
      throw new BadRequestException(
        'Aucun remote origin n’est configuré pour ce repository.',
      );
    }

    const remote = parseGitRemote(repository.remote_url);
    if (!remote) {
      throw new BadRequestException(
        'Le remote origin de ce repository n’a pas pu être interprété.',
      );
    }

    const [gitLabConnections, gitHubConnections] = await Promise.all([
      this.integrations.findAllGitLabRecords(),
      this.integrations.findAllGitHubRecords(),
    ]);
    const connections = [...gitLabConnections, ...gitHubConnections];
    const explicitConnection = repository.connection_id
      ? connections.find(
          (connection) => connection.id === repository.connection_id,
        )
      : undefined;
    if (repository.connection_id && !explicitConnection) {
      throw new NotFoundException(
        'La connexion explicitement associée à ce repository est indisponible.',
      );
    }

    const inferredConnection = explicitConnection
      ? undefined
      : connections.find(
          (connection) =>
            new URL(connection.baseUrl).hostname.toLowerCase() ===
            remote.hostname,
        );
    const connection = explicitConnection ?? inferredConnection;
    if (inferredConnection) {
      await this.repositoryCatalog.associateConnection(
        projectId,
        repositoryId,
        inferredConnection.id,
      );
    }

    const provider =
      connection?.provider ??
      (repository.provider === 'unknown'
        ? detectProviderFromRemote(repository.remote_url)
        : repository.provider);
    if (!connection || provider === 'unknown') {
      throw new BadRequestException(
        'Associez une connexion GitHub ou GitLab à ce repository.',
      );
    }

    const token = await this.integrations.readToken(connection);
    if (!token) {
      throw new UnauthorizedException(
        'Le token de cette connexion est absent du Trousseau macOS.',
      );
    }

    if (provider === 'github' && connection.provider === 'github') {
      return {
        projectId,
        repositoryId,
        repositoryName: repository.name,
        provider,
        issue: await this.github.getIssue(
          token,
          remote.projectPath,
          issueNumber,
        ),
      };
    }

    if (provider === 'gitlab' && connection.provider === 'gitlab') {
      return {
        projectId,
        repositoryId,
        repositoryName: repository.name,
        provider,
        issue: await this.gitlab.getIssue(
          connection.baseUrl,
          token,
          connectionProjectPath(remote, connection),
          issueNumber,
        ),
      };
    }

    throw new BadRequestException(
      'La connexion associée ne correspond pas au provider du repository.',
    );
  }

  private async findForRepository(
    repository: RepositoryRecord,
    gitLabConnections: GitLabConnectionRecord[],
    gitHubConnections: GitHubConnectionRecord[],
  ): Promise<RepositoryIssuesView> {
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

    const connections = [...gitLabConnections, ...gitHubConnections];
    const explicitConnection = repository.connection_id
      ? connections.find(
          (connection) => connection.id === repository.connection_id,
        )
      : undefined;
    if (repository.connection_id && !explicitConnection) {
      return this.emptyRepositoryView(
        repository,
        'connection_required',
        'La connexion explicitement associée à ce repository est indisponible.',
      );
    }

    const inferredConnection = explicitConnection
      ? undefined
      : connections.find(
          (connection) =>
            new URL(connection.baseUrl).hostname.toLowerCase() ===
            remote.hostname,
        );
    const connection = explicitConnection ?? inferredConnection;
    if (inferredConnection) {
      await this.repositoryCatalog.associateConnection(
        repository.project_id,
        repository.id,
        inferredConnection.id,
      );
    }

    const provider =
      connection?.provider ??
      (repository.provider === 'unknown'
        ? detectProviderFromRemote(repository.remote_url)
        : repository.provider);

    if (provider === 'github') {
      return this.findGitHubIssues(
        repository,
        remote,
        connection?.provider === 'github' ? connection : undefined,
      );
    }

    if (provider === 'gitlab') {
      return this.findGitLabIssues(
        repository,
        remote,
        connection?.provider === 'gitlab' ? connection : undefined,
      );
    }

    return this.emptyRepositoryView(
      repository,
      'unsupported',
      'Le provider de ce remote origin n’est pas pris en charge.',
    );
  }

  private async findGitHubIssues(
    repository: RepositoryRecord,
    remote: GitRemoteLocation,
    connection: GitHubConnectionRecord | undefined,
  ): Promise<RepositoryIssuesView> {
    if (!connection) {
      return this.emptyRepositoryView(
        repository,
        'connection_required',
        'Connectez GitHub pour lire les issues.',
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

      return {
        repositoryId: repository.id,
        repositoryName: repository.name,
        provider: 'github',
        state: 'ready',
        issues: await this.github.listIssues(token, remote.projectPath),
      };
    } catch (error) {
      return this.emptyRepositoryView(
        repository,
        this.isConnectionError(error) ? 'connection_required' : 'error',
        error instanceof Error
          ? error.message
          : 'Impossible de charger les issues GitHub.',
      );
    }
  }

  private async findGitLabIssues(
    repository: RepositoryRecord,
    remote: GitRemoteLocation,
    connection: GitLabConnectionRecord | undefined,
  ): Promise<RepositoryIssuesView> {
    if (!connection) {
      return this.emptyRepositoryView(
        repository,
        'connection_required',
        `Connectez ${remote.hostname} pour lire ses issues.`,
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

      return {
        repositoryId: repository.id,
        repositoryName: repository.name,
        provider: 'gitlab',
        state: 'ready',
        issues: await this.gitlab.listIssues(
          connection.baseUrl,
          token,
          connectionProjectPath(remote, connection),
        ),
      };
    } catch (error) {
      return this.emptyRepositoryView(
        repository,
        this.isConnectionError(error) ? 'connection_required' : 'error',
        error instanceof Error
          ? error.message
          : 'Impossible de charger les issues GitLab.',
      );
    }
  }

  private isConnectionError(error: unknown): boolean {
    return (
      error instanceof HttpException &&
      [401, 403, 404].includes(error.getStatus())
    );
  }

  private emptyRepositoryView(
    repository: RepositoryRecord,
    state: RepositoryIssuesView['state'],
    message: string,
  ): RepositoryIssuesView {
    return {
      repositoryId: repository.id,
      repositoryName: repository.name,
      provider: repository.provider,
      state,
      message,
      issues: [],
    };
  }
}

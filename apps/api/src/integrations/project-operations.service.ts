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
  ProjectEnvironmentsView,
  ProjectPullRequestDetailView,
  ProjectPullRequestsView,
  RepositoryEnvironmentsView,
  RepositoryPullRequestsView,
} from './integrations.types';

type ProviderConnectionRecord = GitHubConnectionRecord | GitLabConnectionRecord;

type ReadyRepositoryContext = {
  state: 'ready';
  repository: RepositoryRecord;
  remote: GitRemoteLocation;
  connection: ProviderConnectionRecord;
  token: string;
};

type UnavailableRepositoryContext = {
  state: 'connection_required' | 'unsupported';
  repository: RepositoryRecord;
  provider: RepositoryRecord['provider'];
  message: string;
};

type RepositoryContext = ReadyRepositoryContext | UnavailableRepositoryContext;

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
export class ProjectOperationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repositoryCatalog: RepositoryCatalogService,
    private readonly integrations: IntegrationsService,
    private readonly gitlab: GitLabClientService,
    private readonly github: GitHubClientService,
  ) {}

  async findPullRequests(projectId: string): Promise<ProjectPullRequestsView> {
    const contexts = await this.findContexts(projectId);
    return {
      projectId,
      repositories: await Promise.all(
        contexts.map((context) => this.pullRequestsForContext(context)),
      ),
    };
  }

  async findPullRequest(
    projectId: string,
    repositoryId: string,
    pullRequestNumber: number,
  ): Promise<ProjectPullRequestDetailView> {
    await this.assertProject(projectId);
    const repository = await this.repositoryCatalog.getRecord(
      projectId,
      repositoryId,
    );
    const context = await this.resolveContext(
      repository,
      await this.findConnections(),
    );
    const ready = this.requireReadyContext(context);

    if (ready.connection.provider === 'github') {
      return {
        projectId,
        repositoryId,
        repositoryName: repository.name,
        provider: 'github',
        pullRequest: await this.github.getPullRequest(
          ready.token,
          ready.remote.projectPath,
          pullRequestNumber,
        ),
      };
    }

    return {
      projectId,
      repositoryId,
      repositoryName: repository.name,
      provider: 'gitlab',
      pullRequest: await this.gitlab.getPullRequest(
        ready.connection.baseUrl,
        ready.token,
        connectionProjectPath(ready.remote, ready.connection),
        pullRequestNumber,
      ),
    };
  }

  async findEnvironments(projectId: string): Promise<ProjectEnvironmentsView> {
    const contexts = await this.findContexts(projectId);
    return {
      projectId,
      repositories: await Promise.all(
        contexts.map((context) => this.environmentsForContext(context)),
      ),
    };
  }

  private async pullRequestsForContext(
    context: RepositoryContext,
  ): Promise<RepositoryPullRequestsView> {
    if (context.state !== 'ready') {
      return {
        repositoryId: context.repository.id,
        repositoryName: context.repository.name,
        provider: context.provider,
        state: context.state,
        message: context.message,
        pullRequests: [],
      };
    }

    try {
      const pullRequests =
        context.connection.provider === 'github'
          ? await this.github.listPullRequests(
              context.token,
              context.remote.projectPath,
            )
          : await this.gitlab.listPullRequests(
              context.connection.baseUrl,
              context.token,
              connectionProjectPath(context.remote, context.connection),
            );
      return {
        repositoryId: context.repository.id,
        repositoryName: context.repository.name,
        provider: context.connection.provider,
        state: 'ready',
        pullRequests,
      };
    } catch (error) {
      return {
        repositoryId: context.repository.id,
        repositoryName: context.repository.name,
        provider: context.connection.provider,
        state: this.isConnectionError(error) ? 'connection_required' : 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Impossible de charger les pull requests.',
        pullRequests: [],
      };
    }
  }

  private async environmentsForContext(
    context: RepositoryContext,
  ): Promise<RepositoryEnvironmentsView> {
    if (context.state !== 'ready') {
      return {
        repositoryId: context.repository.id,
        repositoryName: context.repository.name,
        provider: context.provider,
        state: context.state,
        message: context.message,
        environments: [],
      };
    }

    try {
      const environments =
        context.connection.provider === 'github'
          ? await this.github.listEnvironments(
              context.token,
              context.remote.projectPath,
            )
          : await this.gitlab.listEnvironments(
              context.connection.baseUrl,
              context.token,
              connectionProjectPath(context.remote, context.connection),
            );
      return {
        repositoryId: context.repository.id,
        repositoryName: context.repository.name,
        provider: context.connection.provider,
        state: 'ready',
        environments,
      };
    } catch (error) {
      return {
        repositoryId: context.repository.id,
        repositoryName: context.repository.name,
        provider: context.connection.provider,
        state: this.isConnectionError(error) ? 'connection_required' : 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Impossible de charger les environnements.',
        environments: [],
      };
    }
  }

  private async findContexts(projectId: string): Promise<RepositoryContext[]> {
    await this.assertProject(projectId);
    const [repositories, connections] = await Promise.all([
      this.repositoryCatalog.refreshProjectRecords(projectId),
      this.findConnections(),
    ]);
    return Promise.all(
      repositories.map((repository) =>
        this.resolveContext(repository, connections),
      ),
    );
  }

  private async findConnections(): Promise<ProviderConnectionRecord[]> {
    const [gitLabConnections, gitHubConnections] = await Promise.all([
      this.integrations.findAllGitLabRecords(),
      this.integrations.findAllGitHubRecords(),
    ]);
    return [...gitLabConnections, ...gitHubConnections];
  }

  private async resolveContext(
    repository: RepositoryRecord,
    connections: ProviderConnectionRecord[],
  ): Promise<RepositoryContext> {
    if (!repository.remote_url) {
      return {
        state: 'unsupported',
        repository,
        provider: repository.provider,
        message: 'Aucun remote origin n’est configuré.',
      };
    }
    const remote = parseGitRemote(repository.remote_url);
    if (!remote) {
      return {
        state: 'unsupported',
        repository,
        provider: repository.provider,
        message: 'Le remote origin n’a pas pu être interprété.',
      };
    }

    const explicitConnection = repository.connection_id
      ? connections.find(
          (connection) => connection.id === repository.connection_id,
        )
      : undefined;
    if (repository.connection_id && !explicitConnection) {
      return {
        state: 'connection_required',
        repository,
        provider: repository.provider,
        message: 'La connexion explicitement associée est indisponible.',
      };
    }
    const inferredConnection = explicitConnection
      ? undefined
      : connections.find(
          (connection) =>
            new URL(connection.baseUrl).hostname.toLowerCase() ===
            remote.hostname,
        );
    const connection = explicitConnection ?? inferredConnection;
    const provider =
      connection?.provider ??
      (repository.provider === 'unknown'
        ? detectProviderFromRemote(repository.remote_url)
        : repository.provider);
    if (!connection || provider === 'unknown') {
      return {
        state: 'connection_required',
        repository,
        provider,
        message: 'Associez une connexion GitHub ou GitLab à ce repository.',
      };
    }
    if (connection.provider !== provider) {
      return {
        state: 'connection_required',
        repository,
        provider,
        message: 'La connexion associée ne correspond pas au provider.',
      };
    }
    if (inferredConnection) {
      await this.repositoryCatalog.associateConnection(
        repository.project_id,
        repository.id,
        inferredConnection.id,
      );
    }
    const token = await this.integrations.readToken(connection);
    if (!token) {
      return {
        state: 'connection_required',
        repository,
        provider,
        message: 'Le token de cette connexion est absent du Trousseau macOS.',
      };
    }
    return { state: 'ready', repository, remote, connection, token };
  }

  private requireReadyContext(
    context: RepositoryContext,
  ): ReadyRepositoryContext {
    if (context.state === 'ready') return context;
    if (context.state === 'connection_required') {
      throw new UnauthorizedException(context.message);
    }
    throw new BadRequestException(context.message);
  }

  private async assertProject(projectId: string): Promise<void> {
    const project = await this.database
      .connection<{ id: string }>('projects')
      .select('id')
      .where({ id: projectId })
      .first();
    if (!project) throw new NotFoundException('Projet introuvable.');
  }

  private isConnectionError(error: unknown): boolean {
    return (
      error instanceof HttpException &&
      [401, 403, 404].includes(error.getStatus())
    );
  }
}

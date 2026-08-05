import { Injectable, UnauthorizedException } from '@nestjs/common';
import { GitHubClientService } from './github-client.service';
import { GitLabClientService } from './gitlab-client.service';
import {
  IntegrationsService,
  type Provider,
  type ProviderConnectionRecord,
} from './integrations.service';
import type {
  CreateRemoteRepositoryInput,
  RemoteRepositoryView,
} from './integrations.types';

export interface RemoteRepositoryWithCredentials {
  repository: RemoteRepositoryView;
  credentials: {
    username: string;
    password: string;
  };
}

@Injectable()
export class RemoteRepositoriesService {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly github: GitHubClientService,
    private readonly gitlab: GitLabClientService,
  ) {}

  async list(
    provider: Provider,
    connectionId: string,
  ): Promise<RemoteRepositoryView[]> {
    const { connection, token } = await this.connection(provider, connectionId);
    return provider === 'github'
      ? this.github.listRepositories(token, connectionId)
      : this.gitlab.listRepositories(connection.baseUrl, token, connectionId);
  }

  async getWithCredentials(
    provider: Provider,
    connectionId: string,
    repositoryId: string,
  ): Promise<RemoteRepositoryWithCredentials> {
    const { connection, token } = await this.connection(provider, connectionId);
    const repository =
      provider === 'github'
        ? await this.github.getRepository(token, connectionId, repositoryId)
        : await this.gitlab.getRepository(
            connection.baseUrl,
            token,
            connectionId,
            repositoryId,
          );
    return this.withCredentials(repository, connection, token);
  }

  async createWithCredentials(
    provider: Provider,
    connectionId: string,
    input: CreateRemoteRepositoryInput,
  ): Promise<RemoteRepositoryWithCredentials> {
    const { connection, token } = await this.connection(provider, connectionId);
    const repository =
      provider === 'github'
        ? await this.github.createRepository(token, connectionId, input)
        : await this.gitlab.createRepository(
            connection.baseUrl,
            token,
            connectionId,
            input,
          );
    return this.withCredentials(repository, connection, token);
  }

  private async connection(provider: Provider, connectionId: string) {
    const connection = await this.integrations.getConnectionRecord(
      provider,
      connectionId,
    );
    const token = await this.integrations.readToken(connection);
    if (!token) {
      throw new UnauthorizedException(
        `Le token ${provider} est absent du Trousseau macOS. Reconnectez le compte.`,
      );
    }
    return { connection, token };
  }

  private withCredentials(
    repository: RemoteRepositoryView,
    connection: ProviderConnectionRecord,
    token: string,
  ): RemoteRepositoryWithCredentials {
    return {
      repository,
      credentials: {
        username:
          repository.provider === 'github'
            ? 'x-access-token'
            : connection.accountUsername,
        password: token,
      },
    };
  }
}

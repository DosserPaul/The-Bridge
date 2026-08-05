import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { GitLabClientService } from './gitlab-client.service';
import { GitHubClientService } from './github-client.service';
import { GitHubIntegrationsController } from './github-integrations.controller';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { KeychainCredentialService } from './keychain-credential.service';
import { ProjectIssuesController } from './project-issues.controller';
import { ProjectIssuesService } from './project-issues.service';
import { ProjectOperationsController } from './project-operations.controller';
import { ProjectOperationsService } from './project-operations.service';
import { ProjectPipelinesController } from './project-pipelines.controller';
import { ProjectPipelinesService } from './project-pipelines.service';
import { RemoteRepositoriesService } from './remote-repositories.service';

@Module({
  imports: [DatabaseModule, RepositoriesModule],
  controllers: [
    IntegrationsController,
    GitHubIntegrationsController,
    ProjectIssuesController,
    ProjectOperationsController,
    ProjectPipelinesController,
  ],
  providers: [
    IntegrationsService,
    KeychainCredentialService,
    GitLabClientService,
    GitHubClientService,
    ProjectIssuesService,
    ProjectOperationsService,
    ProjectPipelinesService,
    RemoteRepositoriesService,
  ],
  exports: [IntegrationsService, RemoteRepositoriesService],
})
export class IntegrationsModule {}

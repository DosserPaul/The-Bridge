import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { GitLabClientService } from './gitlab-client.service';
import { GitHubClientService } from './github-client.service';
import { GitHubIntegrationsController } from './github-integrations.controller';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { KeychainCredentialService } from './keychain-credential.service';
import { ProjectPipelinesController } from './project-pipelines.controller';
import { ProjectPipelinesService } from './project-pipelines.service';
import { RemoteRepositoriesService } from './remote-repositories.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    IntegrationsController,
    GitHubIntegrationsController,
    ProjectPipelinesController,
  ],
  providers: [
    IntegrationsService,
    KeychainCredentialService,
    GitLabClientService,
    GitHubClientService,
    ProjectPipelinesService,
    RemoteRepositoriesService,
  ],
  exports: [RemoteRepositoriesService],
})
export class IntegrationsModule {}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { ConnectGitHubDto } from './dto/connect-github.dto';
import { IntegrationsService } from './integrations.service';
import { RemoteRepositoriesService } from './remote-repositories.service';

@Controller('integrations/github')
export class GitHubIntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly repositories: RemoteRepositoriesService,
  ) {}

  @Get()
  @ActivityAction({
    category: 'integrations',
    action: 'integration.github.listed',
  })
  list() {
    return this.integrations.listGitHubConnections();
  }

  @Post()
  @ActivityAction({
    category: 'integrations',
    action: 'integration.github.connected',
    subjectType: 'integration',
  })
  connect(@Body() input: ConnectGitHubDto) {
    return this.integrations.connectGitHub(input);
  }

  @Get(':connectionId/repositories')
  @ActivityAction({
    category: 'integrations',
    action: 'integration.github.repositories.listed',
    subjectType: 'integration',
    subjectParam: 'connectionId',
  })
  listRepositories(
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ) {
    return this.repositories.list('github', connectionId);
  }

  @Delete(':connectionId')
  @HttpCode(204)
  @ActivityAction({
    category: 'integrations',
    action: 'integration.github.disconnected',
    subjectType: 'integration',
    subjectParam: 'connectionId',
  })
  disconnect(
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ) {
    return this.integrations.disconnectGitHub(connectionId);
  }
}

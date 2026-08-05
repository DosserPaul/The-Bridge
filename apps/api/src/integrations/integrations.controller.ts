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
import { ConnectGitLabDto } from './dto/connect-gitlab.dto';
import { IntegrationsService } from './integrations.service';
import { RemoteRepositoriesService } from './remote-repositories.service';

@Controller('integrations/gitlab')
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly repositories: RemoteRepositoriesService,
  ) {}

  @Get()
  @ActivityAction({
    category: 'integrations',
    action: 'integration.gitlab.listed',
  })
  list() {
    return this.integrations.listGitLabConnections();
  }

  @Post()
  @ActivityAction({
    category: 'integrations',
    action: 'integration.gitlab.connected',
    subjectType: 'integration',
  })
  connect(@Body() input: ConnectGitLabDto) {
    return this.integrations.connectGitLab(input);
  }

  @Get(':connectionId/repositories')
  @ActivityAction({
    category: 'integrations',
    action: 'integration.gitlab.repositories.listed',
    subjectType: 'integration',
    subjectParam: 'connectionId',
  })
  listRepositories(
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ) {
    return this.repositories.list('gitlab', connectionId);
  }

  @Delete(':connectionId')
  @HttpCode(204)
  @ActivityAction({
    category: 'integrations',
    action: 'integration.gitlab.disconnected',
    subjectType: 'integration',
    subjectParam: 'connectionId',
  })
  disconnect(
    @Param('connectionId', new ParseUUIDPipe({ version: '4' }))
    connectionId: string,
  ) {
    return this.integrations.disconnectGitLab(connectionId);
  }
}

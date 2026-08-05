import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { ProjectHealthService } from './project-health.service';
import { ProjectLocalActionsService } from './project-local-actions.service';

@Controller('projects/:projectId')
export class ProjectOperationsController {
  constructor(
    private readonly actions: ProjectLocalActionsService,
    private readonly health: ProjectHealthService,
  ) {}

  @Get('local-actions')
  @ActivityAction({
    category: 'projects',
    action: 'project.local_actions.viewed',
  })
  listActions(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.actions.list(projectId);
  }

  @Post('repositories/:repositoryId/local-actions/:action')
  @ActivityAction({
    category: 'projects',
    action: 'project.local_action.launched',
  })
  launchAction(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('repositoryId', new ParseUUIDPipe({ version: '4' }))
    repositoryId: string,
    @Param('action') action: string,
  ) {
    return this.actions.launch(projectId, repositoryId, action);
  }

  @Post('local-actions/:runId/stop')
  @ActivityAction({
    category: 'projects',
    action: 'project.local_action.stopped',
  })
  stopAction(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('runId', new ParseUUIDPipe({ version: '4' })) runId: string,
  ) {
    return this.actions.stop(projectId, runId);
  }

  @Get('health')
  @ActivityAction({ category: 'projects', action: 'project.health.viewed' })
  getHealth(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.health.get(projectId);
  }
}

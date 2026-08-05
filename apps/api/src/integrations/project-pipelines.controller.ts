import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { ProjectPipelinesService } from './project-pipelines.service';

@Controller('projects/:projectId/pipelines')
export class ProjectPipelinesController {
  constructor(private readonly pipelines: ProjectPipelinesService) {}

  @Get()
  @ActivityAction({
    category: 'projects',
    action: 'project.pipelines.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  findForProject(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.pipelines.findForProject(projectId);
  }
}

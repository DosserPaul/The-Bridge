import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { ProjectOperationsService } from './project-operations.service';

@Controller('projects/:projectId')
export class ProjectOperationsController {
  constructor(private readonly operations: ProjectOperationsService) {}

  @Get('pull-requests')
  @ActivityAction({
    category: 'projects',
    action: 'project.pull_requests.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  findPullRequests(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.operations.findPullRequests(projectId);
  }

  @Get('repositories/:repositoryId/pull-requests/:pullRequestNumber')
  @ActivityAction({
    category: 'projects',
    action: 'project.pull_request.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  findPullRequest(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('repositoryId', new ParseUUIDPipe({ version: '4' }))
    repositoryId: string,
    @Param('pullRequestNumber', ParseIntPipe) pullRequestNumber: number,
  ) {
    return this.operations.findPullRequest(
      projectId,
      repositoryId,
      pullRequestNumber,
    );
  }

  @Get('environments')
  @ActivityAction({
    category: 'projects',
    action: 'project.environments.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  findEnvironments(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.operations.findEnvironments(projectId);
  }
}

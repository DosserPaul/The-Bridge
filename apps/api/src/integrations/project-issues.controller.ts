import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { ProjectIssuesService } from './project-issues.service';

@Controller('projects/:projectId')
export class ProjectIssuesController {
  constructor(private readonly issues: ProjectIssuesService) {}

  @Get('issues')
  @ActivityAction({
    category: 'projects',
    action: 'project.issues.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  findForProject(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.issues.findForProject(projectId);
  }

  @Get('repositories/:repositoryId/issues/:issueNumber')
  @ActivityAction({
    category: 'projects',
    action: 'project.issue.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  findIssue(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('repositoryId', new ParseUUIDPipe({ version: '4' }))
    repositoryId: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
  ) {
    return this.issues.findIssue(projectId, repositoryId, issueNumber);
  }
}

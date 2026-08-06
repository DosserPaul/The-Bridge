import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { ProjectPlanningService } from './project-planning.service';

@Controller('projects/:projectId')
export class ProjectPlanningController {
  constructor(private readonly planning: ProjectPlanningService) {}

  @Get('milestones')
  @ActivityAction({
    category: 'projects',
    action: 'project.milestones.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  listMilestones(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.planning.listMilestones(projectId);
  }

  @Post('milestones')
  @ActivityAction({
    category: 'projects',
    action: 'project.milestone.created',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  createMilestone(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: CreateMilestoneDto,
  ) {
    return this.planning.createMilestone(projectId, input);
  }

  @Patch('milestones/:milestoneId')
  @ActivityAction({
    category: 'projects',
    action: 'project.milestone.updated',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  updateMilestone(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('milestoneId', new ParseUUIDPipe({ version: '4' }))
    milestoneId: string,
    @Body() input: UpdateMilestoneDto,
  ) {
    return this.planning.updateMilestone(projectId, milestoneId, input);
  }

  @Delete('milestones/:milestoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ActivityAction({
    category: 'projects',
    action: 'project.milestone.deleted',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  removeMilestone(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('milestoneId', new ParseUUIDPipe({ version: '4' }))
    milestoneId: string,
  ) {
    return this.planning.removeMilestone(projectId, milestoneId);
  }

  @Get('decisions')
  @ActivityAction({
    category: 'projects',
    action: 'project.decisions.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  listDecisions(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.planning.listDecisions(projectId);
  }

  @Post('decisions')
  @ActivityAction({
    category: 'projects',
    action: 'project.decision.created',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  createDecision(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: CreateDecisionDto,
  ) {
    return this.planning.createDecision(projectId, input);
  }

  @Patch('decisions/:decisionId')
  @ActivityAction({
    category: 'projects',
    action: 'project.decision.updated',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  updateDecision(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('decisionId', new ParseUUIDPipe({ version: '4' }))
    decisionId: string,
    @Body() input: UpdateDecisionDto,
  ) {
    return this.planning.updateDecision(projectId, decisionId, input);
  }

  @Delete('decisions/:decisionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ActivityAction({
    category: 'projects',
    action: 'project.decision.deleted',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  removeDecision(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('decisionId', new ParseUUIDPipe({ version: '4' }))
    decisionId: string,
  ) {
    return this.planning.removeDecision(projectId, decisionId);
  }
}

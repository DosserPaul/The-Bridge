import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { AgentsService } from './agents.service';
import { CreateAgentTeamDto } from './dto/create-agent-team.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { ReplaceTeamAssignmentsDto } from './dto/replace-team-assignments.dto';
import { UpdateAgentTeamDto } from './dto/update-agent-team.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @ActivityAction({ category: 'agents', action: 'agent.listed' })
  findAll() {
    return this.agents.findAgents();
  }

  @Post()
  @ActivityAction({
    category: 'agents',
    action: 'agent.created',
    subjectType: 'agent',
  })
  create(@Body() input: CreateAgentDto) {
    return this.agents.createAgent(input);
  }

  @Get(':agentId')
  @ActivityAction({
    category: 'agents',
    action: 'agent.viewed',
    subjectType: 'agent',
    subjectParam: 'agentId',
  })
  findOne(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
  ) {
    return this.agents.findAgent(agentId);
  }

  @Patch(':agentId')
  @ActivityAction({
    category: 'agents',
    action: 'agent.updated',
    subjectType: 'agent',
    subjectParam: 'agentId',
  })
  update(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Body() input: UpdateAgentDto,
  ) {
    return this.agents.updateAgent(agentId, input);
  }

  @Post(':agentId/archive')
  @ActivityAction({
    category: 'agents',
    action: 'agent.archived',
    subjectType: 'agent',
    subjectParam: 'agentId',
  })
  archive(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
  ) {
    return this.agents.archiveAgent(agentId);
  }
}

@Controller('agent-teams')
export class AgentTeamsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @ActivityAction({ category: 'agents', action: 'agent_team.listed' })
  findAll() {
    return this.agents.findTeams();
  }

  @Post()
  @ActivityAction({
    category: 'agents',
    action: 'agent_team.created',
    subjectType: 'agent_team',
  })
  create(@Body() input: CreateAgentTeamDto) {
    return this.agents.createTeam(input);
  }

  @Get(':teamId')
  @ActivityAction({
    category: 'agents',
    action: 'agent_team.viewed',
    subjectType: 'agent_team',
    subjectParam: 'teamId',
  })
  findOne(
    @Param('teamId', new ParseUUIDPipe({ version: '4' })) teamId: string,
  ) {
    return this.agents.findTeam(teamId);
  }

  @Patch(':teamId')
  @ActivityAction({
    category: 'agents',
    action: 'agent_team.updated',
    subjectType: 'agent_team',
    subjectParam: 'teamId',
  })
  update(
    @Param('teamId', new ParseUUIDPipe({ version: '4' })) teamId: string,
    @Body() input: UpdateAgentTeamDto,
  ) {
    return this.agents.updateTeam(teamId, input);
  }

  @Put(':teamId/assignments')
  @ActivityAction({
    category: 'agents',
    action: 'agent_team.hierarchy_updated',
    subjectType: 'agent_team',
    subjectParam: 'teamId',
  })
  replaceAssignments(
    @Param('teamId', new ParseUUIDPipe({ version: '4' })) teamId: string,
    @Body() input: ReplaceTeamAssignmentsDto,
  ) {
    return this.agents.replaceTeamAssignments(teamId, input.assignments);
  }

  @Post(':teamId/archive')
  @ActivityAction({
    category: 'agents',
    action: 'agent_team.archived',
    subjectType: 'agent_team',
    subjectParam: 'teamId',
  })
  archive(
    @Param('teamId', new ParseUUIDPipe({ version: '4' })) teamId: string,
  ) {
    return this.agents.archiveTeam(teamId);
  }
}

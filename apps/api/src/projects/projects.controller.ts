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
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { AssociateRepositoryConnectionDto } from './dto/associate-repository-connection.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ValidateRepositoryPathDto } from './dto/validate-repository-path.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @ActivityAction({
    category: 'projects',
    action: 'project.created',
    subjectType: 'project',
  })
  create(@Body() input: CreateProjectDto) {
    return this.projects.create(input);
  }

  @Post('validate-repository-path')
  @ActivityAction({
    category: 'repositories',
    action: 'repository.path_validated',
  })
  validateRepositoryPath(@Body() input: ValidateRepositoryPathDto) {
    return this.projects.validateRepositoryPath(input);
  }

  @Get()
  @ActivityAction({ category: 'projects', action: 'project.listed' })
  findAll() {
    return this.projects.findAll();
  }

  @Get(':projectId')
  @ActivityAction({
    category: 'projects',
    action: 'project.viewed',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  findOne(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.projects.findOne(projectId);
  }

  @Patch(':projectId')
  @ActivityAction({
    category: 'projects',
    action: 'project.updated',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  update(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: UpdateProjectDto,
  ) {
    return this.projects.update(projectId, input);
  }

  @Post(':projectId/archive')
  @ActivityAction({
    category: 'projects',
    action: 'project.archived',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  archive(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.projects.archive(projectId);
  }

  @Post(':projectId/repositories')
  @ActivityAction({
    category: 'repositories',
    action: 'repository.added',
    subjectType: 'project',
    subjectParam: 'projectId',
  })
  addRepository(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: CreateRepositoryDto,
  ) {
    return this.projects.addRepository(projectId, input);
  }

  @Delete(':projectId/repositories/:repositoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ActivityAction({
    category: 'repositories',
    action: 'repository.removed',
    subjectType: 'repository',
    subjectParam: 'repositoryId',
  })
  removeRepository(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('repositoryId', new ParseUUIDPipe({ version: '4' }))
    repositoryId: string,
  ) {
    return this.projects.removeRepository(projectId, repositoryId);
  }

  @Patch(':projectId/repositories/:repositoryId/connection')
  @ActivityAction({
    category: 'repositories',
    action: 'repository.connection_updated',
    subjectType: 'repository',
    subjectParam: 'repositoryId',
  })
  associateRepositoryConnection(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('repositoryId', new ParseUUIDPipe({ version: '4' }))
    repositoryId: string,
    @Body() input: AssociateRepositoryConnectionDto,
  ) {
    return this.projects.associateRepositoryConnection(
      projectId,
      repositoryId,
      input.connectionId ?? null,
    );
  }
}

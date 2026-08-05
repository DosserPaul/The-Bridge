import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
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
}

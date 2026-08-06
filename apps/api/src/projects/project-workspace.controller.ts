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
  Query,
} from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import {
  CreateTimeEntryDto,
  UpdateProjectFinanceDto,
  UpdateTimeEntryDto,
} from './dto/project-commercial.dto';
import {
  CreateProjectDocumentDto,
  PreviewProjectDocumentDto,
  UpdateProjectDocumentDto,
} from './dto/project-document.dto';
import { ProjectWorkspaceService } from './project-workspace.service';

@Controller('projects/:projectId')
export class ProjectWorkspaceController {
  constructor(private readonly workspace: ProjectWorkspaceService) {}

  @Get('documents')
  @ActivityAction({ category: 'projects', action: 'project.documents.viewed' })
  listDocuments(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.workspace.listDocuments(projectId);
  }

  @Get('documents/preview')
  @ActivityAction({
    category: 'projects',
    action: 'project.document.previewed',
  })
  previewDocument(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query() query: PreviewProjectDocumentDto,
  ) {
    return this.workspace.previewDocument(
      projectId,
      query.repositoryId,
      query.path,
    );
  }

  @Post('documents')
  @ActivityAction({ category: 'projects', action: 'project.document.created' })
  createDocument(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: CreateProjectDocumentDto,
  ) {
    return this.workspace.createDocument(projectId, input);
  }

  @Patch('documents/:documentId')
  @ActivityAction({ category: 'projects', action: 'project.document.updated' })
  updateDocument(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @Body() input: UpdateProjectDocumentDto,
  ) {
    return this.workspace.updateDocument(projectId, documentId, input);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ActivityAction({ category: 'projects', action: 'project.document.deleted' })
  removeDocument(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
  ) {
    return this.workspace.removeDocument(projectId, documentId);
  }

  @Get('commercial')
  @ActivityAction({
    category: 'projects',
    action: 'project.commercial.viewed',
  })
  getCommercial(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.workspace.getCommercial(projectId);
  }

  @Patch('commercial/finance')
  @ActivityAction({ category: 'projects', action: 'project.finance.updated' })
  updateFinance(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: UpdateProjectFinanceDto,
  ) {
    return this.workspace.updateFinance(projectId, input);
  }

  @Post('commercial/time-entries')
  @ActivityAction({ category: 'projects', action: 'project.time.created' })
  createTimeEntry(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: CreateTimeEntryDto,
  ) {
    return this.workspace.createTimeEntry(projectId, input);
  }

  @Patch('commercial/time-entries/:entryId')
  @ActivityAction({ category: 'projects', action: 'project.time.updated' })
  updateTimeEntry(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('entryId', new ParseUUIDPipe({ version: '4' })) entryId: string,
    @Body() input: UpdateTimeEntryDto,
  ) {
    return this.workspace.updateTimeEntry(projectId, entryId, input);
  }

  @Delete('commercial/time-entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ActivityAction({ category: 'projects', action: 'project.time.deleted' })
  removeTimeEntry(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('entryId', new ParseUUIDPipe({ version: '4' })) entryId: string,
  ) {
    return this.workspace.removeTimeEntry(projectId, entryId);
  }
}

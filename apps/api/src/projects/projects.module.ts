import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectPlanningController } from './project-planning.controller';
import { ProjectPlanningService } from './project-planning.service';
import { ProjectHealthService } from './project-health.service';
import { ProjectLocalActionsService } from './project-local-actions.service';
import { ProjectOperationsController } from './project-operations.controller';
import { ProjectWorkspaceController } from './project-workspace.controller';
import { ProjectWorkspaceService } from './project-workspace.service';

@Module({
  imports: [DatabaseModule, IntegrationsModule, RepositoriesModule],
  controllers: [
    ProjectsController,
    ProjectPlanningController,
    ProjectWorkspaceController,
    ProjectOperationsController,
  ],
  providers: [
    ProjectsService,
    ProjectPlanningService,
    ProjectWorkspaceService,
    ProjectLocalActionsService,
    ProjectHealthService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}

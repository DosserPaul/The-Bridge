import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { GitService } from './git.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [DatabaseModule, IntegrationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, GitService],
})
export class ProjectsModule {}

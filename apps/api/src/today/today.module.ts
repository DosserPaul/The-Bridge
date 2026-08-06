import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { DatabaseModule } from '../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ProjectsModule } from '../projects/projects.module';
import { TodayController } from './today.controller';
import { TodayService } from './today.service';

@Module({
  imports: [DatabaseModule, ActivityModule, ProjectsModule, IntegrationsModule],
  controllers: [TodayController],
  providers: [TodayService],
})
export class TodayModule {}

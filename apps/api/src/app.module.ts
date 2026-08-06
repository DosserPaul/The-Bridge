import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ActivityModule } from './activity/activity.module';
import { ClientsModule } from './clients/clients.module';
import { DataModule } from './data/data.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ProjectsModule } from './projects/projects.module';
import { TodayModule } from './today/today.module';
import { AgentsModule } from './agents/agents.module';

@Module({
  imports: [
    ActivityModule,
    ClientsModule,
    DataModule,
    ProjectsModule,
    IntegrationsModule,
    TodayModule,
    AgentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

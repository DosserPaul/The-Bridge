import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ActivityModule } from './activity/activity.module';
import { ClientsModule } from './clients/clients.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [ActivityModule, ClientsModule, ProjectsModule, IntegrationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

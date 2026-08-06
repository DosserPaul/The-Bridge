import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AgentsController, AgentTeamsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AgentsController, AgentTeamsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}

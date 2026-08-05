import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { ActivityController } from './activity.controller';
import { ActivityInterceptor } from './activity.interceptor';
import { ActivityService } from './activity.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityInterceptor,
    },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipActivity } from './activity/activity.decorator';

@SkipActivity()
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): { status: 'ok' } {
    return this.appService.getHealth();
  }
}

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SkipActivity } from './activity.decorator';
import { ActivityService } from './activity.service';
import { ListActivityDto } from './dto/list-activity.dto';

@SkipActivity()
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@Query() query: ListActivityDto) {
    return this.activity.list(query);
  }

  @Get(':activityId')
  findOne(
    @Param('activityId', new ParseUUIDPipe({ version: '4' }))
    activityId: string,
  ) {
    return this.activity.findOne(activityId);
  }
}

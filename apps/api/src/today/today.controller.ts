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
} from '@nestjs/common';
import { ActivityAction, SkipActivity } from '../activity/activity.decorator';
import { CreateFocusItemDto } from './dto/create-focus-item.dto';
import { UpdateFocusItemDto } from './dto/update-focus-item.dto';
import { TodayService } from './today.service';

@Controller('today')
export class TodayController {
  constructor(private readonly today: TodayService) {}

  @Get()
  @SkipActivity()
  get() {
    return this.today.get();
  }

  @Post('focus')
  @ActivityAction({
    category: 'today',
    action: 'today.focus.created',
    subjectType: 'focus_item',
  })
  createFocus(@Body() input: CreateFocusItemDto) {
    return this.today.addFocus(input);
  }

  @Patch('focus/:focusId')
  @ActivityAction({
    category: 'today',
    action: 'today.focus.updated',
    subjectType: 'focus_item',
    subjectParam: 'focusId',
  })
  updateFocus(
    @Param('focusId', new ParseUUIDPipe({ version: '4' })) focusId: string,
    @Body() input: UpdateFocusItemDto,
  ) {
    return this.today.updateFocus(focusId, input);
  }

  @Delete('focus/:focusId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ActivityAction({
    category: 'today',
    action: 'today.focus.deleted',
    subjectType: 'focus_item',
    subjectParam: 'focusId',
  })
  removeFocus(
    @Param('focusId', new ParseUUIDPipe({ version: '4' })) focusId: string,
  ) {
    return this.today.removeFocus(focusId);
  }
}

import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post()
  @ActivityAction({
    category: 'clients',
    action: 'client.created',
    subjectType: 'client',
  })
  create(@Body() input: CreateClientDto) {
    return this.clients.create(input);
  }

  @Get()
  @ActivityAction({ category: 'clients', action: 'client.listed' })
  findAll() {
    return this.clients.findAll();
  }

  @Get(':clientId')
  @ActivityAction({
    category: 'clients',
    action: 'client.viewed',
    subjectType: 'client',
    subjectParam: 'clientId',
  })
  findOne(
    @Param('clientId', new ParseUUIDPipe({ version: '4' })) clientId: string,
  ) {
    return this.clients.findOne(clientId);
  }

  @Patch(':clientId')
  @ActivityAction({
    category: 'clients',
    action: 'client.updated',
    subjectType: 'client',
    subjectParam: 'clientId',
  })
  update(
    @Param('clientId', new ParseUUIDPipe({ version: '4' })) clientId: string,
    @Body() input: UpdateClientDto,
  ) {
    return this.clients.update(clientId, input);
  }
}

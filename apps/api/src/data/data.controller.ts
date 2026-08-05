import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ActivityAction } from '../activity/activity.decorator';
import { DataService } from './data.service';

@Controller('data')
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get('status')
  @ActivityAction({ category: 'system', action: 'data.status_viewed' })
  status() {
    return this.data.status();
  }

  @Get('export')
  @Header('Content-Type', 'application/json; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="the-bridge-backup.json"',
  )
  @ActivityAction({ category: 'system', action: 'data.exported' })
  exportData() {
    return this.data.exportDocument();
  }

  @Get('backups')
  @ActivityAction({ category: 'system', action: 'data.backups_listed' })
  listBackups() {
    return this.data.listLocalBackups();
  }

  @Post('backups')
  @ActivityAction({ category: 'system', action: 'data.backup_created' })
  createBackup() {
    return this.data.createLocalBackup();
  }

  @Post('restore')
  @ActivityAction({ category: 'system', action: 'data.restored' })
  restore(@Body() document: unknown) {
    return this.data.restoreDocument(document);
  }

  @Post('backups/:backupId/restore')
  @ActivityAction({
    category: 'system',
    action: 'data.backup_restored',
    subjectType: 'backup',
    subjectParam: 'backupId',
  })
  restoreBackup(@Param('backupId') backupId: string) {
    return this.data.restoreLocalBackup(backupId);
  }
}

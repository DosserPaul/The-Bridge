import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { GitService } from '../projects/git.service';
import { RepositoryCatalogService } from './repository-catalog.service';

@Module({
  imports: [DatabaseModule],
  providers: [GitService, RepositoryCatalogService],
  exports: [GitService, RepositoryCatalogService],
})
export class RepositoriesModule {}

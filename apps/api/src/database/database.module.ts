import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: async () => {
        const database = new DatabaseService();
        await database.initialize();
        return database;
      },
    },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}

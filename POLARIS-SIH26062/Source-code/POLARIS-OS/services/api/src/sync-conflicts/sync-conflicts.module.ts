import { Module } from '@nestjs/common';
import { SyncConflictsController } from './sync-conflicts.controller.js';
import { SyncConflictsService } from './sync-conflicts.service.js';
import { SyncOperationsModule } from '../sync-operations/sync-operations.module.js';

@Module({
  controllers: [SyncConflictsController],
  imports: [SyncOperationsModule],
  providers: [SyncConflictsService],
  exports: [SyncConflictsService],
})
export class SyncConflictsModule {}

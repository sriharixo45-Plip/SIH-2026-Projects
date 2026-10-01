import { Module } from '@nestjs/common';
import { SyncOperationsController } from './sync-operations.controller.js';
import { SyncOperationsService } from './sync-operations.service.js';

@Module({
  controllers: [SyncOperationsController],
  providers: [SyncOperationsService],
  exports: [SyncOperationsService],
})
export class SyncOperationsModule {}

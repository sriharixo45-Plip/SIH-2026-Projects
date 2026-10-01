import { Module } from '@nestjs/common';
import { SyncDevicesController } from './sync-devices.controller.js';
import { SyncDevicesService } from './sync-devices.service.js';

@Module({
  controllers: [SyncDevicesController],
  providers: [SyncDevicesService],
  exports: [SyncDevicesService],
})
export class SyncDevicesModule {}

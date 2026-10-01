import { Module } from '@nestjs/common';
import { TransportResourcesController } from './transport-resources.controller.js';
import { TransportResourcesService } from './transport-resources.service.js';

@Module({
  controllers: [TransportResourcesController],
  providers: [TransportResourcesService],
  exports: [TransportResourcesService],
})
export class TransportResourcesModule {}

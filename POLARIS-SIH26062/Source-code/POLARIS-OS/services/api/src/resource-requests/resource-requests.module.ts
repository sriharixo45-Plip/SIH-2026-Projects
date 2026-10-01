import { Module } from '@nestjs/common';
import { ResourceRequestsController } from './resource-requests.controller.js';
import { ResourceRequestsService } from './resource-requests.service.js';

@Module({
  controllers: [ResourceRequestsController],
  providers: [ResourceRequestsService],
  exports: [ResourceRequestsService],
})
export class ResourceRequestsModule {}

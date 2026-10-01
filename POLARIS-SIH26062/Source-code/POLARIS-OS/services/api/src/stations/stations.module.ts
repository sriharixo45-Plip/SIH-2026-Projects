import { Module } from '@nestjs/common';
import { StationsController } from './stations.controller.js';
import { StationsService } from './stations.service.js';

@Module({
  controllers: [StationsController],
  providers: [StationsService],
})
export class StationsModule {}

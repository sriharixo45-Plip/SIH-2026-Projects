import { Module } from '@nestjs/common';
import { ExpeditionStationsController } from './expedition-stations.controller.js';
import { ExpeditionStationsService } from './expedition-stations.service.js';

@Module({
  controllers: [ExpeditionStationsController],
  providers: [ExpeditionStationsService],
  exports: [ExpeditionStationsService],
})
export class ExpeditionStationsModule {}

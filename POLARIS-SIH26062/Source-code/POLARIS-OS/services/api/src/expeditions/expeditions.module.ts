import { Module } from '@nestjs/common';
import { ExpeditionsController } from './expeditions.controller.js';
import { ExpeditionsService } from './expeditions.service.js';

@Module({
  controllers: [ExpeditionsController],
  providers: [ExpeditionsService],
  exports: [ExpeditionsService],
})
export class ExpeditionsModule {}

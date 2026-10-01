import { Module } from '@nestjs/common';
import { PlanVersionsController } from './plan-versions.controller.js';
import { PlanVersionsService } from './plan-versions.service.js';

@Module({
  controllers: [PlanVersionsController],
  providers: [PlanVersionsService],
  exports: [PlanVersionsService],
})
export class PlanVersionsModule {}

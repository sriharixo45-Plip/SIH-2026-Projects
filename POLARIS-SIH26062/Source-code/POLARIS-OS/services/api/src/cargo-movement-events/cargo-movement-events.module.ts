import { Module } from '@nestjs/common';
import { CargoMovementEventsController } from './cargo-movement-events.controller.js';
import { CargoMovementEventsService } from './cargo-movement-events.service.js';

@Module({
  controllers: [CargoMovementEventsController],
  providers: [CargoMovementEventsService],
  exports: [CargoMovementEventsService],
})
export class CargoMovementEventsModule {}

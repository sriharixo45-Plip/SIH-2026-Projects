import { Module } from '@nestjs/common';
import { CargoItemsController } from './cargo-items.controller.js';
import { CargoItemsService } from './cargo-items.service.js';

@Module({
  controllers: [CargoItemsController],
  providers: [CargoItemsService],
  exports: [CargoItemsService],
})
export class CargoItemsModule {}

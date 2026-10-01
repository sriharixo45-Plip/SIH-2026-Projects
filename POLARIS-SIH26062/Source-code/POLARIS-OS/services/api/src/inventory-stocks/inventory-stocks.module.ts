import { Module } from '@nestjs/common';
import { InventoryStocksController } from './inventory-stocks.controller.js';
import { InventoryStocksService } from './inventory-stocks.service.js';

@Module({
  controllers: [InventoryStocksController],
  providers: [InventoryStocksService],
  exports: [InventoryStocksService],
})
export class InventoryStocksModule {}

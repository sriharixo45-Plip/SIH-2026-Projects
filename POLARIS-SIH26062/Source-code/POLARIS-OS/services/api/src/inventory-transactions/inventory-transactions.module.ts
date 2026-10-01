import { Module } from '@nestjs/common';
import { InventoryTransactionsController } from './inventory-transactions.controller.js';
import { InventoryTransactionsService } from './inventory-transactions.service.js';

@Module({
  controllers: [InventoryTransactionsController],
  providers: [InventoryTransactionsService],
  exports: [InventoryTransactionsService],
})
export class InventoryTransactionsModule {}

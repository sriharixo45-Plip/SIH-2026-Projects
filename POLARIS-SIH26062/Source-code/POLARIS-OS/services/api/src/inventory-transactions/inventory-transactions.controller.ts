import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto.js';
import { UpdateInventoryTransactionDto } from './dto/update-inventory-transaction.dto.js';
import { InventoryTransactionsService } from './inventory-transactions.service.js';

@Controller('inventory-transactions')
export class InventoryTransactionsController {
  constructor(private readonly inventoryTransactionsService: InventoryTransactionsService) {}

  @Get()
  findAll() {
    return this.inventoryTransactionsService.findAll();
  }

  @Get('stock/:stockId')
  findByStock(@Param('stockId') stockId: string) {
    return this.inventoryTransactionsService.findByStock(stockId);
  }

  @Get('transfer/:transferId')
  findByTransfer(@Param('transferId') transferId: string) {
    return this.inventoryTransactionsService.findByTransfer(transferId);
  }

  @Get(':id')
  findOne(@Param('id') transactionId: string) {
    return this.inventoryTransactionsService.findOne(transactionId);
  }

  @Post()
  create(@Body() dto: CreateInventoryTransactionDto) {
    return this.inventoryTransactionsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') transactionId: string, @Body() dto: UpdateInventoryTransactionDto) {
    return this.inventoryTransactionsService.update(transactionId, dto);
  }
}

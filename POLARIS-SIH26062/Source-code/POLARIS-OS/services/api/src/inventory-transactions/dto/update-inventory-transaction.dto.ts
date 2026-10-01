import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryTransactionDto } from './create-inventory-transaction.dto.js';

export class UpdateInventoryTransactionDto extends PartialType(CreateInventoryTransactionDto) {
  transaction_type?: never;
  stock_id?: never;
  quantity_delta?: never;
}

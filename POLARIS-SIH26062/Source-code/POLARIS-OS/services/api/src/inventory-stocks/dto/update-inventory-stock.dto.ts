import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryStockDto } from './create-inventory-stock.dto.js';

export class UpdateInventoryStockDto extends PartialType(CreateInventoryStockDto) {
  quantity?: never;
}

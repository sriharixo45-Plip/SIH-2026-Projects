import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInventoryStockDto {
  @IsString()
  @IsNotEmpty()
  station_id: string;

  @IsString()
  @IsNotEmpty()
  item_catalog_id: string;

  @IsNumber()
  quantity: string | number;

  @IsNumber()
  reorder_threshold: string | number;

  @IsNumber()
  safety_stock_minimum: string | number;
}

import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCargoItemDto {
  @IsString()
  @IsNotEmpty()
  tracking_code: string;

  @IsString()
  @IsNotEmpty()
  leg_id: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  weight: string | number;

  @IsNumber()
  volume: string | number;

  @IsOptional()
  @IsInt()
  hazard_class?: number | null;

  @IsOptional()
  is_return_cargo?: boolean;

  @IsIn(['packed', 'in_transit', 'in_storage_at_station', 'delivered', 'damaged', 'returned'])
  status: 'packed' | 'in_transit' | 'in_storage_at_station' | 'delivered' | 'damaged' | 'returned';

  @IsOptional()
  @IsString()
  parent_shipment_id?: string | null;

  @IsString()
  @IsNotEmpty()
  actor: string;
}

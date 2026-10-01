import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTransportResourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  registration_code: string;

  @IsNumber()
  max_capacity_weight: string | number;

  @IsNumber()
  max_capacity_volume: string | number;

  @IsInt()
  max_seats_berths: number;

  @IsOptional()
  @IsIn(['available', 'maintenance', 'unavailable'])
  status?: 'available' | 'maintenance' | 'unavailable';

  @IsOptional()
  available_from?: string;

  @IsOptional()
  available_to?: string;
}

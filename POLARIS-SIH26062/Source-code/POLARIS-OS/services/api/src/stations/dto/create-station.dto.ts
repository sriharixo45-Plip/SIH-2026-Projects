import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class StationLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class CreateStationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsIn(['antarctic', 'arctic'])
  type: 'antarctic' | 'arctic';

  @ValidateNested()
  @Type(() => StationLocationDto)
  location: StationLocationDto;

  @IsString()
  @IsNotEmpty()
  storage_capacity_weight: string | number;

  @IsString()
  @IsNotEmpty()
  storage_capacity_volume: string | number;

  @IsString()
  @IsNotEmpty()
  timezone: string;

  @IsOptional()
  @IsIn(['active', 'seasonal_closure', 'under_maintenance', 'decommissioned'])
  status?: 'active' | 'seasonal_closure' | 'under_maintenance' | 'decommissioned';
}

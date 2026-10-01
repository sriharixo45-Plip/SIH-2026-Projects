import { Type } from 'class-transformer';
import {
  IsIn,
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

export class UpdateStationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsIn(['antarctic', 'arctic'])
  type?: 'antarctic' | 'arctic';

  @IsOptional()
  @ValidateNested()
  @Type(() => StationLocationDto)
  location?: StationLocationDto;

  @IsOptional()
  @IsString()
  storage_capacity_weight?: string | number;

  @IsOptional()
  @IsString()
  storage_capacity_volume?: string | number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(['active', 'seasonal_closure', 'under_maintenance', 'decommissioned'])
  status?: 'active' | 'seasonal_closure' | 'under_maintenance' | 'decommissioned';
}

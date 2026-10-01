import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class TransportLegLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class CreateTransportLegDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  expedition_id: string;

  @IsString()
  @IsNotEmpty()
  transport_resource_id: string;

  @IsString()
  @IsNotEmpty()
  mode: string;

  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransportLegLocationDto)
  origin_point?: TransportLegLocationDto | null;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransportLegLocationDto)
  destination_point?: TransportLegLocationDto | null;

  @IsDateString()
  planned_departure: string;

  @IsDateString()
  planned_arrival: string;

  @IsIn(['planned', 'confirmed', 'delayed', 'departed', 'in_transit', 'arrived', 'cancelled', 'diverted'])
  status: 'planned' | 'confirmed' | 'delayed' | 'departed' | 'in_transit' | 'arrived' | 'cancelled' | 'diverted';

  @IsOptional()
  @IsNumber()
  capacity_weight?: string | number;

  @IsOptional()
  @IsNumber()
  capacity_volume?: string | number;

  @IsOptional()
  @IsInt()
  capacity_seats?: number;

  @IsOptional()
  hazard_restrictions?: number[];

  @IsOptional()
  @IsBoolean()
  allow_concurrent_leg?: boolean;
}

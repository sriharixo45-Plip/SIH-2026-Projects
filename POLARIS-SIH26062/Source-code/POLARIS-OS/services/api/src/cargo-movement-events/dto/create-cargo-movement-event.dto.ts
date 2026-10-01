import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCargoMovementEventDto {
  @IsString()
  @IsNotEmpty()
  cargo_id: string;

  @IsOptional()
  @IsString()
  leg_id?: string | null;

  @IsOptional()
  @IsString()
  station_id?: string | null;

  @IsString()
  @IsNotEmpty()
  event_type: string;

  @IsString()
  @IsNotEmpty()
  actor: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

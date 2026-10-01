import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePersonnelAssignmentDto {
  @IsString()
  @IsNotEmpty()
  personnel_id: string;

  @IsString()
  @IsNotEmpty()
  expedition_id: string;

  @IsOptional()
  @IsString()
  station_id?: string | null;

  @IsOptional()
  @IsString()
  leg_id?: string | null;

  @IsOptional()
  @IsString()
  seat_berth_ref?: string | null;

  @IsIn(['proposed', 'confirmed', 'in-transit', 'deployed', 'completed', 'cancelled', 'unassigned'])
  status: 'proposed' | 'confirmed' | 'in-transit' | 'deployed' | 'completed' | 'cancelled' | 'unassigned';

  @IsDateString()
  start_date: string;

  @IsOptional()
  @IsDateString()
  end_date?: string | null;

  @IsOptional()
  @IsString()
  rotation_id?: string | null;
}

import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateIncidentDto {
  @IsOptional()
  @IsString()
  station_id?: string | null;

  @IsOptional()
  @IsString()
  leg_id?: string | null;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  declared_by: string;

  @IsIn(['low', 'moderate', 'high', 'critical'])
  severity: 'low' | 'moderate' | 'high' | 'critical';

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  status?: 'declared' | 'active' | 'resource_requested' | 'resolved' | 'closed' | 'reopened';
}

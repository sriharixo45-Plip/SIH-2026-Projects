import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateExpeditionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  season: string;

  @IsDateString()
  planned_start: string;

  @IsDateString()
  planned_end: string;

  @IsOptional()
  @IsString()
  status?: 'draft' | 'planned' | 'approved' | 'in_progress' | 'disrupted' | 'completed' | 'cancelled';

  @IsString()
  @IsNotEmpty()
  created_by: string;

  @IsOptional()
  current_plan_version_id?: string;
}

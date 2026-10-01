import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePlanVersionDto {
  @IsString()
  @IsNotEmpty()
  expedition_id: string;

  @IsString()
  @IsNotEmpty()
  created_by: string;

  @IsOptional()
  @IsString()
  status?: 'proposed' | 'approved' | 'rejected' | 'superseded';

  @IsOptional()
  @IsString()
  change_summary?: string;

  @IsOptional()
  snapshot?: Record<string, unknown>;
}

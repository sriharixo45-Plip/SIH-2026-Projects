import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateIncidentEventDto {
  @IsString()
  @IsNotEmpty()
  event_type: string;

  @IsString()
  @IsNotEmpty()
  actor: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

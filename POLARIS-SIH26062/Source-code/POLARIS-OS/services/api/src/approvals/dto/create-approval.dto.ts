import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApprovalDto {
  @IsString()
  entity_type: string;

  @IsUUID()
  entity_id: string;

  @IsUUID()
  requested_by: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

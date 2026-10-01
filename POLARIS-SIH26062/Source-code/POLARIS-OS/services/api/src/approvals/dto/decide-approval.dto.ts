import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class DecideApprovalDto {
  @IsOptional()
  @IsUUID()
  decided_by?: string;

  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}

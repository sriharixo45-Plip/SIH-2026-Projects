import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsUUID } from 'class-validator';

export class UpdateUserRoleAssignmentDto {
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @IsOptional()
  @IsUUID()
  station_id?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  valid_from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  valid_to?: Date | null;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

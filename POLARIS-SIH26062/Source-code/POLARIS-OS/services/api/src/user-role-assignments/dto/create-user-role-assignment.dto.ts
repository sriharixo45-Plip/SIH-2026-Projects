import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUserRoleAssignmentDto {
  @IsUUID()
  user_id: string;

  @IsUUID()
  role_id: string;

  @IsOptional()
  @IsUUID()
  station_id?: string;

  @Type(() => Date)
  @IsDate()
  valid_from: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  valid_to?: Date;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

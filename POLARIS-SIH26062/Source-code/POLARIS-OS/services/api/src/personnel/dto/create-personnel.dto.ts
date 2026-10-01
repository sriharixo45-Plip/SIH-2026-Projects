import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePersonnelDto {
  @IsOptional()
  @IsString()
  user_id?: string | null;

  @IsOptional()
  @IsString()
  employee_code?: string | null;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  role_on_expedition: string;

  @IsIn(['fit-to-deploy', 'conditional', 'not-fit', 'pending-review'])
  fitness_status: 'fit-to-deploy' | 'conditional' | 'not-fit' | 'pending-review';

  @IsOptional()
  @IsString()
  assigned_station_id?: string | null;
}

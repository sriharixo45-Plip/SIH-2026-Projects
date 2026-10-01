import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class RegisterSyncDeviceDto {
  @IsUUID()
  device_id: string;

  @IsIn(['station-pwa', 'hq-web'])
  device_type: 'station-pwa' | 'hq-web';

  @IsUUID()
  assigned_station_id: string;

  @IsOptional()
  @IsUUID()
  assigned_user_id?: string | null;

  @IsString()
  @MinLength(1)
  app_version: string;
}

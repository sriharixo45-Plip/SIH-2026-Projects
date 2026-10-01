import { IsNotEmpty, IsString } from 'class-validator';

export class CreateExpeditionStationDto {
  @IsString()
  @IsNotEmpty()
  expedition_id: string;

  @IsString()
  @IsNotEmpty()
  station_id: string;
}

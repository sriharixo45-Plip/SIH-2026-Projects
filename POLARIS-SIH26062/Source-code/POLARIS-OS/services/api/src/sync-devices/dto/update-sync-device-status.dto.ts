import { IsIn } from 'class-validator';

export class UpdateSyncDeviceStatusDto {
  @IsIn(['active', 'revoked'])
  status: 'active' | 'revoked';
}

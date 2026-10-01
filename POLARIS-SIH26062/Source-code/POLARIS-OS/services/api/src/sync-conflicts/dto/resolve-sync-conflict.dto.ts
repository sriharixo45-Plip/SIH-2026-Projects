import { IsIn } from 'class-validator';

export class ResolveSyncConflictDto {
  @IsIn(['accepted_server', 'accepted_incoming'])
  resolution: 'accepted_server' | 'accepted_incoming';
}

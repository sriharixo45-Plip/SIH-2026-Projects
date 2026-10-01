import { IsArray, IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateSyncConflictDto {
  @IsIn(['cargo_item', 'transport_leg', 'inventory_stock', 'personnel_assignment', 'incident', 'expedition', 'approval'])
  entity_type: string;

  @IsUUID()
  entity_id: string;

  @IsArray()
  @IsUUID('all', { each: true })
  competing_operations: string[];
}

import { IsDateString, IsIn, IsInt, IsObject, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateSyncOperationDto {
  @IsUUID()
  op_id: string;

  @IsUUID()
  device_id: string;

  @IsUUID()
  performed_by: string;

  @IsInt()
  @Min(1)
  local_sequence_number: number;

  @IsIn(['cargo_item', 'transport_leg', 'inventory_stock', 'personnel_assignment', 'incident', 'expedition', 'approval'])
  target_entity_type: string;

  @IsUUID()
  target_entity_id: string;

  @IsIn(['create', 'update', 'status_change', 'cancel'])
  operation_type: 'create' | 'update' | 'status_change' | 'cancel';

  @IsObject()
  payload: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  base_version?: number | null;

  @IsOptional()
  @IsDateString()
  local_timestamp?: string | null;
}

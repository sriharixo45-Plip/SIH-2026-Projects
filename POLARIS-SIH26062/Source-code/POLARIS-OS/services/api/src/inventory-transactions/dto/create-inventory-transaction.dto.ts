import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInventoryTransactionDto {
  @IsString()
  @IsNotEmpty()
  stock_id: string;

  @IsOptional()
  @IsString()
  transport_leg_id?: string | null;

  @IsIn(['receipt', 'consumption', 'transfer_out', 'transfer_in', 'damage', 'loss', 'adjustment', 'return'])
  transaction_type: 'receipt' | 'consumption' | 'transfer_out' | 'transfer_in' | 'damage' | 'loss' | 'adjustment' | 'return';

  @IsString()
  @IsNotEmpty()
  quantity_delta: string | number;

  @IsString()
  @IsNotEmpty()
  actor: string;

  @IsOptional()
  @IsString()
  reason?: string | null;

  @IsOptional()
  @IsString()
  transfer_id?: string | null;
}

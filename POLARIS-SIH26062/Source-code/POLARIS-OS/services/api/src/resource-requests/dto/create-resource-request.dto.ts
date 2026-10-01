import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateResourceRequestLineDto {
  @IsString()
  @IsNotEmpty()
  resource_type: 'personnel' | 'cargo' | 'inventory' | 'transport';

  @IsNumber()
  quantity: string | number;

  @IsOptional()
  @IsString()
  item_reference?: string | null;

  @IsOptional()
  @IsString()
  item_reference_note?: string | null;
}

export class CreateResourceRequestDto {
  @IsString()
  @IsNotEmpty()
  incident_id: string;

  @IsString()
  @IsNotEmpty()
  requested_by: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateResourceRequestLineDto)
  lines?: CreateResourceRequestLineDto[];
}

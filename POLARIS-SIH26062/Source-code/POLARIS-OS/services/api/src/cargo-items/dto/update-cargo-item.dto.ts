import { PartialType } from '@nestjs/mapped-types';
import { CreateCargoItemDto } from './create-cargo-item.dto.js';

export class UpdateCargoItemDto extends PartialType(CreateCargoItemDto) {}

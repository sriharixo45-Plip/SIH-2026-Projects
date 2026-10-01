import { PartialType } from '@nestjs/mapped-types';
import { CreateItemCatalogDto } from './create-item-catalog.dto.js';

export class UpdateItemCatalogDto extends PartialType(CreateItemCatalogDto) {}

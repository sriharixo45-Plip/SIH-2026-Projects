import { PartialType } from '@nestjs/mapped-types';
import { CreatePersonnelDto } from './create-personnel.dto.js';

export class UpdatePersonnelDto extends PartialType(CreatePersonnelDto) {}

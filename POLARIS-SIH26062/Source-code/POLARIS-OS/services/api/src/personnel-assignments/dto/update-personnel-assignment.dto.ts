import { PartialType } from '@nestjs/mapped-types';
import { CreatePersonnelAssignmentDto } from './create-personnel-assignment.dto.js';

export class UpdatePersonnelAssignmentDto extends PartialType(CreatePersonnelAssignmentDto) {}

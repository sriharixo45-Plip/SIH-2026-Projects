import { PartialType } from '@nestjs/mapped-types';
import { CreateResourceRequestDto } from './create-resource-request.dto.js';

export class UpdateResourceRequestDto extends PartialType(CreateResourceRequestDto) {
  status?: string;
}

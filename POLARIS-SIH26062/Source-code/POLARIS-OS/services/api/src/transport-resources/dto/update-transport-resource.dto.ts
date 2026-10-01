import { PartialType } from '@nestjs/mapped-types';
import { CreateTransportResourceDto } from './create-transport-resource.dto.js';

export class UpdateTransportResourceDto extends PartialType(CreateTransportResourceDto) {}

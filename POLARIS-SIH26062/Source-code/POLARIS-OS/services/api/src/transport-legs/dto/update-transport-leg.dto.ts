import { PartialType } from '@nestjs/mapped-types';
import { CreateTransportLegDto } from './create-transport-leg.dto.js';

export class UpdateTransportLegDto extends PartialType(CreateTransportLegDto) {}

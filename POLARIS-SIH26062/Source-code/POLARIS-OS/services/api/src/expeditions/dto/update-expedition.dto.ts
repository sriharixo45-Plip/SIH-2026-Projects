import { PartialType } from '@nestjs/mapped-types';
import { CreateExpeditionDto } from './create-expedition.dto.js';

export class UpdateExpeditionDto extends PartialType(CreateExpeditionDto) {}

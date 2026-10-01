import { PartialType } from '@nestjs/mapped-types';
import { CreateIncidentDto } from './create-incident.dto.js';

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
  status?: 'declared' | 'active' | 'resource_requested' | 'resolved' | 'closed' | 'reopened';
  reason?: string;
  reopen_reason?: string;
}

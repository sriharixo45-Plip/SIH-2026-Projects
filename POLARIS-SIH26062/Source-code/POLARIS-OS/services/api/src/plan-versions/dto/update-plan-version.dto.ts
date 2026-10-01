import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanVersionDto } from './create-plan-version.dto.js';

export class UpdatePlanVersionDto extends PartialType(CreatePlanVersionDto) {}

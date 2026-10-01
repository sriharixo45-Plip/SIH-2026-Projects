import { PartialType } from '@nestjs/mapped-types';
import { CreateRecommendationDto } from './create-recommendation.dto.js';

export class UpdateRecommendationDto extends PartialType(CreateRecommendationDto) {
  status?: 'generated' | 'under_review' | 'decided' | 'applied' | 'superseded';
}

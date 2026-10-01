import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRecommendationDto {
  @IsIn(['transport_disruption', 'incident', 'inventory_risk', 'weather_event'])
  trigger_type: 'transport_disruption' | 'incident' | 'inventory_risk' | 'weather_event';

  @IsString()
  @IsNotEmpty()
  trigger_id: string;

  @IsString()
  @IsNotEmpty()
  recommendation_type: string;

  @IsOptional()
  proposed_change?: Record<string, any> | null;

  @IsString()
  @IsNotEmpty()
  constraint_basis: string;

  @IsOptional()
  @IsIn(['generated', 'under_review', 'decided', 'applied', 'superseded'])
  status?: 'generated' | 'under_review' | 'decided' | 'applied' | 'superseded';

  @IsOptional()
  @IsString()
  approval_id?: string | null;
}

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateRecommendationDto } from './dto/create-recommendation.dto.js';
import { UpdateRecommendationDto } from './dto/update-recommendation.dto.js';
import { RecommendationsService } from './recommendations.service.js';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get()
  findAll() {
    return this.recommendationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') recommendationId: string) {
    return this.recommendationsService.findOne(recommendationId);
  }

  @Get('trigger/:triggerType/:triggerId')
  findByTrigger(@Param('triggerType') triggerType: string, @Param('triggerId') triggerId: string) {
    return this.recommendationsService.findByTrigger(triggerType, triggerId);
  }

  @Post()
  create(@Body() dto: CreateRecommendationDto) {
    return this.recommendationsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') recommendationId: string, @Body() dto: UpdateRecommendationDto) {
    return this.recommendationsService.update(recommendationId, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') recommendationId: string, @Body() body: { status: string }) {
    return this.recommendationsService.updateStatus(recommendationId, body.status);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePlanVersionDto } from './dto/create-plan-version.dto.js';
import { UpdatePlanVersionDto } from './dto/update-plan-version.dto.js';
import { PlanVersionsService } from './plan-versions.service.js';

@Controller('plan-versions')
export class PlanVersionsController {
  constructor(private readonly planVersionsService: PlanVersionsService) {}

  @Get()
  findAll() {
    return this.planVersionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') versionId: string) {
    return this.planVersionsService.findOne(versionId);
  }

  @Post()
  create(@Body() dto: CreatePlanVersionDto) {
    return this.planVersionsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') versionId: string, @Body() dto: UpdatePlanVersionDto) {
    return this.planVersionsService.update(versionId, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') versionId: string, @Body() body: { status: string }) {
    return this.planVersionsService.updateStatus(versionId, body.status as any);
  }
}

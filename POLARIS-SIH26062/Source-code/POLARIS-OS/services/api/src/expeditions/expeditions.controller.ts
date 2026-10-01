import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateExpeditionDto } from './dto/create-expedition.dto.js';
import { UpdateExpeditionDto } from './dto/update-expedition.dto.js';
import { ExpeditionsService } from './expeditions.service.js';

@Controller('expeditions')
export class ExpeditionsController {
  constructor(private readonly expeditionsService: ExpeditionsService) {}

  @Get()
  findAll() {
    return this.expeditionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') expeditionId: string) {
    return this.expeditionsService.findOne(expeditionId);
  }

  @Post()
  create(@Body() dto: CreateExpeditionDto) {
    return this.expeditionsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') expeditionId: string, @Body() dto: UpdateExpeditionDto) {
    return this.expeditionsService.update(expeditionId, dto);
  }

  @Delete(':id')
  remove(@Param('id') expeditionId: string) {
    return this.expeditionsService.remove(expeditionId);
  }

  @Get(':id/stations')
  findStations(@Param('id') expeditionId: string) {
    return this.expeditionsService.findStations(expeditionId);
  }

  @Post(':id/stations')
  addStation(
    @Param('id') expeditionId: string,
    @Body() dto: { station_id: string },
  ) {
    return this.expeditionsService.addStation(expeditionId, dto.station_id);
  }

  @Get(':id/plan-versions')
  findPlanVersions(@Param('id') expeditionId: string) {
    return this.expeditionsService.findPlanVersions(expeditionId);
  }

  @Post(':id/plan-versions')
  createPlanVersion(
    @Param('id') expeditionId: string,
    @Body() dto: { created_by: string; status?: string; change_summary?: string; snapshot?: Record<string, unknown> },
  ) {
    return this.expeditionsService.createPlanVersion(expeditionId, dto);
  }

  @Patch(':id/current-plan-version')
  setCurrentPlanVersion(
    @Param('id') expeditionId: string,
    @Body() dto: { version_id: string },
  ) {
    return this.expeditionsService.setCurrentPlanVersion(expeditionId, dto.version_id);
  }
}

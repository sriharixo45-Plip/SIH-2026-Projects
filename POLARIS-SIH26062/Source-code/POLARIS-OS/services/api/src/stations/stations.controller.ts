import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateStationDto } from './dto/create-station.dto.js';
import { UpdateStationDto } from './dto/update-station.dto.js';
import { StationsService } from './stations.service.js';

@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  findAll() {
    return this.stationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') stationId: string) {
    return this.stationsService.findOne(stationId);
  }

  @Post()
  create(@Body() dto: CreateStationDto) {
    return this.stationsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') stationId: string, @Body() dto: UpdateStationDto) {
    return this.stationsService.update(stationId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') stationId: string,
    @Body() body: { deleted_by?: string } = {},
  ) {
    return this.stationsService.remove(stationId, body.deleted_by);
  }

  @Post(':id/restore')
  restore(@Param('id') stationId: string) {
    return this.stationsService.restore(stationId);
  }
}

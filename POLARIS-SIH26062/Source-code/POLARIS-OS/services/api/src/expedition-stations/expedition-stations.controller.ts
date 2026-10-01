import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CreateExpeditionStationDto } from './dto/create-expedition-station.dto.js';
import { ExpeditionStationsService } from './expedition-stations.service.js';

@Controller('expedition-stations')
export class ExpeditionStationsController {
  constructor(private readonly expeditionStationsService: ExpeditionStationsService) {}

  @Get()
  findAll() {
    return this.expeditionStationsService.findAll();
  }

  @Get(':expeditionId')
  findByExpedition(@Param('expeditionId') expeditionId: string) {
    return this.expeditionStationsService.findByExpedition(expeditionId);
  }

  @Post()
  create(@Body() dto: CreateExpeditionStationDto) {
    return this.expeditionStationsService.create(dto);
  }

  @Delete(':expeditionId/:stationId')
  remove(
    @Param('expeditionId') expeditionId: string,
    @Param('stationId') stationId: string,
  ) {
    return this.expeditionStationsService.remove(expeditionId, stationId);
  }
}

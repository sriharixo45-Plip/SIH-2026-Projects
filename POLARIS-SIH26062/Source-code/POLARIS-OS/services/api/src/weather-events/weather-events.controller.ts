import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { WeatherEventsService } from './weather-events.service.js';

@Controller('weather-events')
export class WeatherEventsController {
  constructor(
    private readonly weatherEventsService: WeatherEventsService,
  ) {}

  @Get()
  findAll() {
    return this.weatherEventsService.findAll();
  }

  @Get('station/:stationId')
  findByStation(@Param('stationId') stationId: string) {
    return this.weatherEventsService.findByStation(stationId);
  }

  @Post()
  create(
    @Body()
    body: {
      station_id?: string;
      event_type: string;
      severity: string;
      logged_by: string;
      source: string;
      notes?: string;
    },
  ) {
    return this.weatherEventsService.create(body);
  }
}
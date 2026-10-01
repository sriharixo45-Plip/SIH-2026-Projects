import { Module } from '@nestjs/common';
import { WeatherEventsController } from './weather-events.controller.js';
import { WeatherEventsService } from './weather-events.service.js';

@Module({
  controllers: [WeatherEventsController],
  providers: [WeatherEventsService]
})
export class WeatherEventsModule {}

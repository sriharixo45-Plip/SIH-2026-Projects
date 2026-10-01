import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CreateCargoMovementEventDto } from './dto/create-cargo-movement-event.dto.js';
import { CargoMovementEventsService } from './cargo-movement-events.service.js';

@Controller('cargo-movement-events')
export class CargoMovementEventsController {
  constructor(private readonly cargoMovementEventsService: CargoMovementEventsService) {}

  @Get()
  findAll() {
    return this.cargoMovementEventsService.findAll();
  }

  @Get(':cargoId')
  findByCargo(@Param('cargoId') cargoId: string) {
    return this.cargoMovementEventsService.findByCargo(cargoId);
  }

  @Post()
  create(@Body() dto: CreateCargoMovementEventDto) {
    return this.cargoMovementEventsService.create(dto);
  }
}

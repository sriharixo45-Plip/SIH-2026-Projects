import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateCargoItemDto } from './dto/create-cargo-item.dto.js';
import { UpdateCargoItemDto } from './dto/update-cargo-item.dto.js';
import { CargoItemsService } from './cargo-items.service.js';

@Controller('cargo-items')
export class CargoItemsController {
  constructor(private readonly cargoItemsService: CargoItemsService) {}

  @Get()
  findAll() {
    return this.cargoItemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') cargoId: string) {
    return this.cargoItemsService.findOne(cargoId);
  }

  @Get(':id/movement-events')
  findMovementEvents(@Param('id') cargoId: string) {
    return this.cargoItemsService.findMovementEvents(cargoId);
  }

  @Post()
  create(@Body() dto: CreateCargoItemDto) {
    return this.cargoItemsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') cargoId: string, @Body() dto: UpdateCargoItemDto) {
    return this.cargoItemsService.update(cargoId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') cargoId: string,
    @Body() body: { status: string; actor: string; reason?: string },
  ) {
    return this.cargoItemsService.updateStatus(cargoId, body.status, body.actor, body.reason);
  }

  @Delete(':id')
  remove(@Param('id') cargoId: string) {
    return this.cargoItemsService.remove(cargoId);
  }
}

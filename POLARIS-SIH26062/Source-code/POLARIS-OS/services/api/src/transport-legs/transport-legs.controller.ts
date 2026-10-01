import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateTransportLegDto } from './dto/create-transport-leg.dto.js';
import { UpdateTransportLegDto } from './dto/update-transport-leg.dto.js';
import { TransportLegsService } from './transport-legs.service.js';

@Controller('transport-legs')
export class TransportLegsController {
  constructor(private readonly transportLegsService: TransportLegsService) {}

  @Get()
  findAll() {
    return this.transportLegsService.findAll();
  }

  @Get(':id/impact')
  getImpact(@Param('id') legId: string) {
    return this.transportLegsService.getDisruptionImpact(legId);
  }

  @Get(':id')
  findOne(@Param('id') legId: string) {
    return this.transportLegsService.findOne(legId);
  }

  @Post()
  create(@Body() dto: CreateTransportLegDto) {
    return this.transportLegsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') legId: string, @Body() dto: UpdateTransportLegDto) {
    return this.transportLegsService.update(legId, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') legId: string, @Body() body: { status: string }) {
    return this.transportLegsService.updateStatus(legId, body.status);
  }

  @Delete(':id')
  remove(@Param('id') legId: string) {
    return this.transportLegsService.remove(legId);
  }
}

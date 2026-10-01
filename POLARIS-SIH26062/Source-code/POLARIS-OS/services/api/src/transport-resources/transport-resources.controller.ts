import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateTransportResourceDto } from './dto/create-transport-resource.dto.js';
import { UpdateTransportResourceDto } from './dto/update-transport-resource.dto.js';
import { TransportResourcesService } from './transport-resources.service.js';

@Controller('transport-resources')
export class TransportResourcesController {
  constructor(private readonly transportResourcesService: TransportResourcesService) {}

  @Get()
  findAll() {
    return this.transportResourcesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') resourceId: string) {
    return this.transportResourcesService.findOne(resourceId);
  }

  @Post()
  create(@Body() dto: CreateTransportResourceDto) {
    return this.transportResourcesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') resourceId: string, @Body() dto: UpdateTransportResourceDto) {
    return this.transportResourcesService.update(resourceId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') resourceId: string,
    @Body() body: { status: 'available' | 'maintenance' | 'unavailable' },
  ) {
    return this.transportResourcesService.updateStatus(resourceId, body.status);
  }

  @Delete(':id')
  remove(@Param('id') resourceId: string) {
    return this.transportResourcesService.remove(resourceId);
  }
}

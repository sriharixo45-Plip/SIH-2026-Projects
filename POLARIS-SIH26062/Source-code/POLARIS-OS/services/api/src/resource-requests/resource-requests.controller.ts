import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateResourceRequestDto } from './dto/create-resource-request.dto.js';
import { UpdateResourceRequestDto } from './dto/update-resource-request.dto.js';
import { ResourceRequestsService } from './resource-requests.service.js';

@Controller('resource-requests')
export class ResourceRequestsController {
  constructor(private readonly resourceRequestsService: ResourceRequestsService) {}

  @Get()
  findAll() {
    return this.resourceRequestsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') requestId: string) {
    return this.resourceRequestsService.findOne(requestId);
  }

  @Get(':id/lines')
  findLines(@Param('id') requestId: string) {
    return this.resourceRequestsService.findLines(requestId);
  }

  @Get('incident/:incidentId')
  findByIncident(@Param('incidentId') incidentId: string) {
    return this.resourceRequestsService.findByIncident(incidentId);
  }

  @Post()
  create(@Body() dto: CreateResourceRequestDto) {
    return this.resourceRequestsService.create(dto);
  }

  @Post(':id/lines')
  createLine(@Param('id') requestId: string, @Body() dto: any) {
    return this.resourceRequestsService.createLine(requestId, dto);
  }

  @Patch(':id')
  update(@Param('id') requestId: string, @Body() dto: UpdateResourceRequestDto) {
    return this.resourceRequestsService.update(requestId, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') requestId: string, @Body() body: { status: string }) {
    return this.resourceRequestsService.updateStatus(requestId, body.status);
  }
}

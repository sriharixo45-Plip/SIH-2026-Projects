import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateIncidentDto } from './dto/create-incident.dto.js';
import { CreateIncidentEventDto } from './dto/create-incident-event.dto.js';
import { UpdateIncidentDto } from './dto/update-incident.dto.js';
import { IncidentsService } from './incidents.service.js';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findAll() {
    return this.incidentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') incidentId: string) {
    return this.incidentsService.findOne(incidentId);
  }

  @Get(':id/events')
  findEvents(@Param('id') incidentId: string) {
    return this.incidentsService.findEvents(incidentId);
  }

  @Post()
  create(@Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(dto);
  }

  @Post(':id/events')
  createEvent(@Param('id') incidentId: string, @Body() dto: CreateIncidentEventDto) {
    return this.incidentsService.createEvent(incidentId, dto);
  }

  @Patch(':id')
  update(@Param('id') incidentId: string, @Body() dto: UpdateIncidentDto) {
    return this.incidentsService.update(incidentId, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') incidentId: string, @Body() body: { status: string; reason?: string }) {
    return this.incidentsService.updateStatus(incidentId, body.status, body.reason);
  }
}

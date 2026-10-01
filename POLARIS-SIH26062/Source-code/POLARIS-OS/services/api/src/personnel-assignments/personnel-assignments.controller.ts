import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePersonnelAssignmentDto } from './dto/create-personnel-assignment.dto.js';
import { UpdatePersonnelAssignmentDto } from './dto/update-personnel-assignment.dto.js';
import { PersonnelAssignmentsService } from './personnel-assignments.service.js';

@Controller('personnel-assignments')
export class PersonnelAssignmentsController {
  constructor(private readonly personnelAssignmentsService: PersonnelAssignmentsService) {}

  @Get()
  findAll() {
    return this.personnelAssignmentsService.findAll();
  }

  @Get('personnel/:personnelId')
  findByPersonnel(@Param('personnelId') personnelId: string) {
    return this.personnelAssignmentsService.findByPersonnel(personnelId);
  }

  @Get('expedition/:expeditionId')
  findByExpedition(@Param('expeditionId') expeditionId: string) {
    return this.personnelAssignmentsService.findByExpedition(expeditionId);
  }

  @Get('station/:stationId')
  findByStation(@Param('stationId') stationId: string) {
    return this.personnelAssignmentsService.findByStation(stationId);
  }

  @Get('leg/:legId')
  findByLeg(@Param('legId') legId: string) {
    return this.personnelAssignmentsService.findByLeg(legId);
  }

  @Get(':id')
  findOne(@Param('id') assignmentId: string) {
    return this.personnelAssignmentsService.findOne(assignmentId);
  }

  @Post()
  create(@Body() dto: CreatePersonnelAssignmentDto) {
    return this.personnelAssignmentsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') assignmentId: string, @Body() dto: UpdatePersonnelAssignmentDto) {
    return this.personnelAssignmentsService.update(assignmentId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') assignmentId: string,
    @Body() body: { status: 'proposed' | 'confirmed' | 'in-transit' | 'deployed' | 'completed' | 'cancelled' | 'unassigned' },
  ) {
    return this.personnelAssignmentsService.updateStatus(assignmentId, body.status);
  }
}

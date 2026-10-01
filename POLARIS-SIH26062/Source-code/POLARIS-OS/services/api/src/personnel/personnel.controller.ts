import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePersonnelDto } from './dto/create-personnel.dto.js';
import { UpdatePersonnelDto } from './dto/update-personnel.dto.js';
import { PersonnelService } from './personnel.service.js';

@Controller('personnel')
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  @Get()
  findAll() {
    return this.personnelService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') personId: string) {
    return this.personnelService.findOne(personId);
  }

  @Post()
  create(@Body() dto: CreatePersonnelDto) {
    return this.personnelService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') personId: string, @Body() dto: UpdatePersonnelDto) {
    return this.personnelService.update(personId, dto);
  }

  @Patch(':id/fitness-status')
  updateFitnessStatus(
    @Param('id') personId: string,
    @Body() body: { fitness_status: 'fit-to-deploy' | 'conditional' | 'not-fit' | 'pending-review' },
  ) {
    return this.personnelService.updateFitnessStatus(personId, body.fitness_status);
  }
}

import { Module } from '@nestjs/common';
import { PersonnelAssignmentsController } from './personnel-assignments.controller.js';
import { PersonnelAssignmentsService } from './personnel-assignments.service.js';

@Module({
  controllers: [PersonnelAssignmentsController],
  providers: [PersonnelAssignmentsService],
  exports: [PersonnelAssignmentsService],
})
export class PersonnelAssignmentsModule {}

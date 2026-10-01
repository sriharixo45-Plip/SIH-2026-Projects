import { Module } from '@nestjs/common';
import { UserRoleAssignmentsController } from './user-role-assignments.controller.js';
import { UserRoleAssignmentsService } from './user-role-assignments.service.js';

@Module({
  controllers: [UserRoleAssignmentsController],
  providers: [UserRoleAssignmentsService],
})
export class UserRoleAssignmentsModule {}

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateUserRoleAssignmentDto } from './dto/create-user-role-assignment.dto.js';
import { UpdateUserRoleAssignmentDto } from './dto/update-user-role-assignment.dto.js';
import { UserRoleAssignmentsService } from './user-role-assignments.service.js';

@Controller('user-role-assignments')
export class UserRoleAssignmentsController {
  constructor(
    private readonly userRoleAssignmentsService: UserRoleAssignmentsService,
  ) {}

  @Get()
  findAll() {
    return this.userRoleAssignmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') assignmentId: string) {
    return this.userRoleAssignmentsService.findOne(assignmentId);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.userRoleAssignmentsService.findByUser(userId);
  }

  @Post()
  create(@Body() dto: CreateUserRoleAssignmentDto) {
    return this.userRoleAssignmentsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') assignmentId: string,
    @Body() dto: UpdateUserRoleAssignmentDto,
  ) {
    return this.userRoleAssignmentsService.update(assignmentId, dto);
  }
}

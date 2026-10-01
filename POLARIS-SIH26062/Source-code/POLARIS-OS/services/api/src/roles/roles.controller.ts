import { Controller, Get, Param } from '@nestjs/common';
import { RolesService } from './roles.service.js';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') roleId: string) {
    return this.rolesService.findOne(roleId);
  }

  @Get(':id/permissions')
  findPermissions(@Param('id') roleId: string) {
    return this.rolesService.findPermissions(roleId);
  }
}
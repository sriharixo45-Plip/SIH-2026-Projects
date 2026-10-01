import { Controller, Get, Param } from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') permissionId: string) {
    return this.permissionsService.findOne(permissionId);
  }
}

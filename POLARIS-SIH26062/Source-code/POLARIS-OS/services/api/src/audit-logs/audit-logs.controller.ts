import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service.js';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
  ) {
    return this.auditLogsService.findAll(entityType, entityId);
  }

  @Get(':id')
  findOne(@Param('id') logId: string) {
    return this.auditLogsService.findOne(logId);
  }
}

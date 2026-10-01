import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateSyncOperationDto } from './dto/create-sync-operation.dto.js';
import { SyncOperationsService } from './sync-operations.service.js';

@Controller('sync-operations')
@UseGuards(JwtAuthGuard)
export class SyncOperationsController {
  constructor(private readonly syncOperationsService: SyncOperationsService) {}

  @Get()
  findAll() {
    return this.syncOperationsService.findAll();
  }

  @Get('changes')
  changes(@Query('cursor', new DefaultValuePipe(0), ParseIntPipe) cursor: number, @Query('device_id', ParseUUIDPipe) deviceId: string, @Req() req: any) {
    return this.syncOperationsService.findChanges(cursor, deviceId, req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') opId: string) {
    return this.syncOperationsService.findOne(opId);
  }

  @Get('device/:deviceId')
  findByDevice(@Param('deviceId') deviceId: string) {
    return this.syncOperationsService.findByDevice(deviceId);
  }

  @Post()
  create(@Body() dto: CreateSyncOperationDto, @Req() req: any) {
    return this.syncOperationsService.create(dto, req.user.sub);
  }

  @Patch(':id/apply')
  apply(@Param('id') opId: string) {
    return this.syncOperationsService.applyOperation(opId);
  }

  @Patch(':id/reject')
  reject(@Param('id') opId: string, @Body() body: { reason?: string } = {}) {
    return this.syncOperationsService.rejectOperation(opId, body.reason);
  }
}

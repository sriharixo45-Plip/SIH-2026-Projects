import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CreateSyncConflictDto } from './dto/create-sync-conflict.dto.js';
import { ResolveSyncConflictDto } from './dto/resolve-sync-conflict.dto.js';
import { SyncConflictsService } from './sync-conflicts.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('sync-conflicts')
@UseGuards(JwtAuthGuard)
export class SyncConflictsController {
  constructor(private readonly syncConflictsService: SyncConflictsService) {}

  @Get()
  findAll() {
    return this.syncConflictsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') conflictId: string) {
    return this.syncConflictsService.findOne(conflictId);
  }

  @Post()
  create(@Body() dto: CreateSyncConflictDto) {
    return this.syncConflictsService.create(dto);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') conflictId: string, @Body() body: ResolveSyncConflictDto, @Req() req: any) {
    return this.syncConflictsService.resolve(conflictId, body.resolution, req.user.sub);
  }
}

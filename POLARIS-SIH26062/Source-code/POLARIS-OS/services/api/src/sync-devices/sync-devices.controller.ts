import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RegisterSyncDeviceDto } from './dto/register-sync-device.dto.js';
import { SyncDevicesService } from './sync-devices.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdateSyncDeviceStatusDto } from './dto/update-sync-device-status.dto.js';

@Controller('sync-devices')
@UseGuards(JwtAuthGuard)
export class SyncDevicesController {
  constructor(private readonly syncDevicesService: SyncDevicesService) {}

  @Get()
  findAll() {
    return this.syncDevicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') deviceId: string) {
    return this.syncDevicesService.findOne(deviceId);
  }

  @Post('register')
  register(@Body() dto: RegisterSyncDeviceDto, @Req() req: any) {
    const stationId = req.user.station_id;
    if (!stationId || stationId !== dto.assigned_station_id) {
      throw new ForbiddenException('Device station must match the authenticated user station.');
    }
    return this.syncDevicesService.register({ ...dto, assigned_user_id: req.user.sub });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') deviceId: string, @Body() body: UpdateSyncDeviceStatusDto) {
    return this.syncDevicesService.updateStatus(deviceId, body.status);
  }
}

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { RegisterSyncDeviceDto } from './dto/register-sync-device.dto.js';

@Injectable()
export class SyncDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDevice(deviceId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "sync_device" WHERE "device_id" = $1 LIMIT 1;`,
      deviceId,
    );

    const device = rows[0];
    if (!device) {
      throw new NotFoundException(`Sync device with id ${deviceId} was not found.`);
    }

    return device;
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "sync_device" ORDER BY "device_id" ASC;`,
    );
  }

  async findOne(deviceId: string) {
    return this.getDevice(deviceId);
  }

  async register(data: RegisterSyncDeviceDto) {
    const existingRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "sync_device" WHERE "device_id" = $1 LIMIT 1;`,
      data.device_id,
    );

    if (existingRows[0]) {
      const existing = existingRows[0];
      if (existing.assigned_user_id !== (data.assigned_user_id ?? null) || existing.assigned_station_id !== data.assigned_station_id || existing.device_type !== data.device_type) {
        throw new ForbiddenException('Sync device is assigned to another user.');
      }
      if (existing.status !== 'active') throw new ForbiddenException('Sync device has been revoked.');
      const updated = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE "sync_device" SET "assigned_user_id" = $1, "assigned_station_id" = $2, "app_version" = $3 WHERE "device_id" = $4 RETURNING *;`,
        data.assigned_user_id ?? null, data.assigned_station_id, data.app_version, data.device_id,
      );
      if (!updated[0]) throw new NotFoundException(`Sync device with id ${data.device_id} was not found.`);
      return updated[0];
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "sync_device"
        ("device_id", "device_type", "assigned_user_id", "assigned_station_id", "app_version")
      VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5)
      RETURNING *;
      `,
      data.device_id,
      data.device_type,
      data.assigned_user_id ?? null,
      data.assigned_station_id,
      data.app_version,
    );

    if (rows[0]) {
      return rows[0];
    }

    throw new ConflictException('The device could not be registered in the database.');
  }

  async updateStatus(deviceId: string, status: 'active' | 'revoked') {
    await this.getDevice(deviceId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "sync_device" SET "status" = $1 WHERE "device_id" = $2 RETURNING *;`,
      status,
      deviceId,
    );

    if (!rows[0]) throw new NotFoundException(`Sync device with id ${deviceId} was not found.`);
    return rows[0];
  }

  async revoke(deviceId: string) {
    return this.updateStatus(deviceId, 'revoked');
  }
}

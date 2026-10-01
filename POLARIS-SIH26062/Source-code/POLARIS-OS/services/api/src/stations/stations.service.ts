import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateStationDto, StationLocationDto } from './dto/create-station.dto.js';
import { UpdateStationDto } from './dto/update-station.dto.js';

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toLocationValue(location?: StationLocationDto | null) {
    if (!location) {
      return undefined;
    }

    return `POINT(${location.longitude} ${location.latitude})`;
  }

  private async getActiveStation(stationId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "station" WHERE "station_id" = $1 AND "deleted_at" IS NULL LIMIT 1;`,
      stationId,
    );

    const station = rows[0];

    if (!station) {
      throw new NotFoundException(`Station with id ${stationId} was not found.`);
    }

    return station;
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "station" WHERE "deleted_at" IS NULL ORDER BY "name" ASC;`,
    );
  }

  async findOne(stationId: string) {
    return this.getActiveStation(stationId);
  }

  async create(data: CreateStationDto) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "station"
          ("name", "code", "type", "location", "storage_capacity_weight", "storage_capacity_volume", "status", "timezone")
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
        `,
        data.name,
        data.code,
        data.type,
        this.toLocationValue(data.location),
        Number(data.storage_capacity_weight),
        Number(data.storage_capacity_volume),
        data.status ?? 'active',
        data.timezone,
      );

      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === '23505') {
        throw new ConflictException('A station with this code already exists.');
      }
      throw error;
    }
  }

  async update(stationId: string, data: UpdateStationDto) {
    await this.getActiveStation(stationId);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`"name" = $${params.length}`);
    }
    if (data.code !== undefined) {
      params.push(data.code);
      updates.push(`"code" = $${params.length}`);
    }
    if (data.type !== undefined) {
      params.push(data.type);
      updates.push(`"type" = $${params.length}`);
    }
    if (data.location) {
      params.push(this.toLocationValue(data.location));
      updates.push(`"location" = $${params.length}`);
    }
    if (data.storage_capacity_weight !== undefined) {
      params.push(Number(data.storage_capacity_weight));
      updates.push(`"storage_capacity_weight" = $${params.length}`);
    }
    if (data.storage_capacity_volume !== undefined) {
      params.push(Number(data.storage_capacity_volume));
      updates.push(`"storage_capacity_volume" = $${params.length}`);
    }
    if (data.timezone !== undefined) {
      params.push(data.timezone);
      updates.push(`"timezone" = $${params.length}`);
    }
    if (data.status !== undefined) {
      params.push(data.status);
      updates.push(`"status" = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.getActiveStation(stationId);
    }

    params.push(stationId);
    const sql = `UPDATE "station" SET ${updates.join(', ')} WHERE "station_id" = $${params.length} RETURNING *;`;

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === '23505') {
        throw new ConflictException('A station with this code already exists.');
      }
      throw error;
    }
  }

  async remove(stationId: string, deletedBy?: string) {
    await this.getActiveStation(stationId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "station" SET "deleted_at" = NOW(), "deleted_by" = $2 WHERE "station_id" = $1 RETURNING *;`,
      stationId,
      deletedBy ?? null,
    );

    return rows[0];
  }

  async restore(stationId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "station" WHERE "station_id" = $1 LIMIT 1;`,
      stationId,
    );

    const station = rows[0];

    if (!station) {
      throw new NotFoundException(`Station with id ${stationId} was not found.`);
    }

    if (!station.deleted_at) {
      return station;
    }

    const updated = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "station" SET "deleted_at" = NULL, "deleted_by" = NULL WHERE "station_id" = $1 RETURNING *;`,
      stationId,
    );

    return updated[0];
  }
}

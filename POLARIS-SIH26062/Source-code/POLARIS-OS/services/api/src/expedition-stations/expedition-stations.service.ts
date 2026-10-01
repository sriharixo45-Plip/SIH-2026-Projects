import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateExpeditionStationDto } from './dto/create-expedition-station.dto.js';

@Injectable()
export class ExpeditionStationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "expedition_station" ORDER BY "expedition_id" ASC;`,
    );
  }

  async findByExpedition(expeditionId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "expedition_station" WHERE "expedition_id" = $1 ORDER BY "station_id" ASC;`,
      expeditionId,
    );
  }

  async create(data: CreateExpeditionStationDto) {
    const expeditionRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "expedition" WHERE "expedition_id" = $1 LIMIT 1;`,
      data.expedition_id,
    );

    if (!expeditionRows[0]) {
      throw new NotFoundException(`Expedition with id ${data.expedition_id} was not found.`);
    }

    const stationRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "station" WHERE "station_id" = $1 LIMIT 1;`,
      data.station_id,
    );

    if (!stationRows[0]) {
      throw new NotFoundException(`Station with id ${data.station_id} was not found.`);
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "expedition_station" ("expedition_id", "station_id") VALUES ($1, $2) RETURNING *;`,
        data.expedition_id,
        data.station_id,
      );
      return rows[0];
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('This station is already associated with the expedition.');
      }
      throw error;
    }
  }

  async remove(expeditionId: string, stationId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `DELETE FROM "expedition_station" WHERE "expedition_id" = $1 AND "station_id" = $2 RETURNING *;`,
      expeditionId,
      stationId,
    );

    if (!rows[0]) {
      throw new NotFoundException(
        `Association between expedition ${expeditionId} and station ${stationId} was not found.`,
      );
    }

    return rows[0];
  }
}

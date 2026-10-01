import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateCargoMovementEventDto } from './dto/create-cargo-movement-event.dto.js';

@Injectable()
export class CargoMovementEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "cargo_movement_event" ORDER BY "timestamp_utc" ASC;`,
    );
  }

  async findByCargo(cargoId: string) {
    const cargoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "cargo_item" WHERE "cargo_id" = $1 LIMIT 1;`,
      cargoId,
    );

    if (!cargoRows[0]) {
      throw new NotFoundException(`Cargo item with id ${cargoId} was not found.`);
    }

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "cargo_movement_event" WHERE "cargo_id" = $1 ORDER BY "timestamp_utc" ASC;`,
      cargoId,
    );
  }

  async create(data: CreateCargoMovementEventDto) {
    const cargoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "cargo_item" WHERE "cargo_id" = $1 LIMIT 1;`,
      data.cargo_id,
    );

    if (!cargoRows[0]) {
      throw new NotFoundException(`Cargo item with id ${data.cargo_id} was not found.`);
    }

    if (data.leg_id) {
      const legRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "transport_leg" WHERE "leg_id" = $1 LIMIT 1;`,
        data.leg_id,
      );

      if (!legRows[0]) {
        throw new NotFoundException(`Transport leg with id ${data.leg_id} was not found.`);
      }
    }

    if (data.station_id) {
      const stationRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "station" WHERE "station_id" = $1 LIMIT 1;`,
        data.station_id,
      );

      if (!stationRows[0]) {
        throw new NotFoundException(`Station with id ${data.station_id} was not found.`);
      }
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "cargo_movement_event"
          ("cargo_id", "leg_id", "station_id", "event_type", "timestamp_utc", "actor", "reason")
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        RETURNING *;
        `,
        data.cargo_id,
        data.leg_id ?? null,
        data.station_id ?? null,
        data.event_type,
        data.actor,
        data.reason ?? null,
      );

      return rows[0];
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('The cargo movement event could not be recorded.');
      }
      throw error;
    }
  }
}

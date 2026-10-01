import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateTransportResourceDto } from './dto/create-transport-resource.dto.js';
import { UpdateTransportResourceDto } from './dto/update-transport-resource.dto.js';

@Injectable()
export class TransportResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTransportResource(resourceId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "transport_resource" WHERE "resource_id" = $1 LIMIT 1;`,
      resourceId,
    );

    const resource = rows[0];

    if (!resource) {
      throw new NotFoundException(`Transport resource with id ${resourceId} was not found.`);
    }

    return resource;
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "transport_resource" ORDER BY "name" ASC;`,
    );
  }

  async findOne(resourceId: string) {
    return this.getTransportResource(resourceId);
  }

  async create(data: CreateTransportResourceDto) {
    const weight = Number(data.max_capacity_weight);
    const volume = Number(data.max_capacity_volume);
    if (weight <= 0 || volume <= 0) {
      throw new ConflictException('Capacity values must be greater than zero.');
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "transport_resource"
          ("name", "type", "registration_code", "max_capacity_weight", "max_capacity_volume", "max_seats_berths", "status", "available_from", "available_to")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
        `,
        data.name,
        data.type,
        data.registration_code,
        weight,
        volume,
        Number(data.max_seats_berths),
        data.status ?? 'available',
        data.available_from ? new Date(data.available_from) : null,
        data.available_to ? new Date(data.available_to) : null,
      );

      return rows[0];
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('A transport resource with this registration code already exists.');
      }
      throw error;
    }
  }

  async update(resourceId: string, data: UpdateTransportResourceDto) {
    await this.getTransportResource(resourceId);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) { params.push(data.name); updates.push(`"name" = $${params.length}`); }
    if (data.type !== undefined) { params.push(data.type); updates.push(`"type" = $${params.length}`); }
    if (data.registration_code !== undefined) { params.push(data.registration_code); updates.push(`"registration_code" = $${params.length}`); }
    if (data.max_capacity_weight !== undefined) {
      const value = Number(data.max_capacity_weight);
      if (value <= 0) throw new ConflictException('Capacity values must be greater than zero.');
      params.push(value); updates.push(`"max_capacity_weight" = $${params.length}`);
    }
    if (data.max_capacity_volume !== undefined) {
      const value = Number(data.max_capacity_volume);
      if (value <= 0) throw new ConflictException('Capacity values must be greater than zero.');
      params.push(value); updates.push(`"max_capacity_volume" = $${params.length}`);
    }
    if (data.max_seats_berths !== undefined) {
      params.push(Number(data.max_seats_berths)); updates.push(`"max_seats_berths" = $${params.length}`);
    }
    if (data.status !== undefined) { params.push(data.status); updates.push(`"status" = $${params.length}`); }
    if (data.available_from !== undefined) { params.push(data.available_from ? new Date(data.available_from) : null); updates.push(`"available_from" = $${params.length}`); }
    if (data.available_to !== undefined) { params.push(data.available_to ? new Date(data.available_to) : null); updates.push(`"available_to" = $${params.length}`); }

    if (updates.length === 0) {
      return this.getTransportResource(resourceId);
    }

    params.push(resourceId);
    const sql = `UPDATE "transport_resource" SET ${updates.join(', ')} WHERE "resource_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0];
  }

  async updateStatus(resourceId: string, status: 'available' | 'maintenance' | 'unavailable') {
    const resource = await this.getTransportResource(resourceId);

    if (resource.status === status) {
      return resource;
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "transport_resource" SET "status" = $1 WHERE "resource_id" = $2 RETURNING *;`,
      status,
      resourceId,
    );

    return rows[0];
  }

  async remove(resourceId: string) {
    await this.getTransportResource(resourceId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `DELETE FROM "transport_resource" WHERE "resource_id" = $1 RETURNING *;`,
      resourceId,
    );
    return rows[0];
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateCargoItemDto } from './dto/create-cargo-item.dto.js';
import { UpdateCargoItemDto } from './dto/update-cargo-item.dto.js';

@Injectable()
export class CargoItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly allowedTransitions: Record<string, string[]> = {
    packed: ['in_transit', 'in_storage_at_station', 'damaged', 'returned'],
    in_transit: ['in_storage_at_station', 'delivered', 'damaged', 'returned'],
    in_storage_at_station: ['delivered', 'damaged', 'returned'],
    delivered: ['returned'],
    damaged: ['returned'],
    returned: [],
  };

  private async getCargo(cargoId: string) {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "cargo_item" WHERE "cargo_id" = $1 LIMIT 1;`,
      cargoId,
    );

    const cargo = rows[0];

    if (!cargo) {
      throw new NotFoundException(`Cargo item with id ${cargoId} was not found.`);
    }

    return cargo;
  }

  private async ensureNoParentCycle(cargoId: string, parentShipmentId: string | null | undefined) {
    if (!parentShipmentId) {
      return;
    }

    if (parentShipmentId === cargoId) {
      throw new ConflictException('Cargo cannot be its own parent shipment.');
    }

    let currentParentId: string | null = parentShipmentId;
    const visited = new Set<string>();

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        break;
      }
      visited.add(currentParentId);

      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "parent_shipment_id" FROM "cargo_item" WHERE "cargo_id" = $1 LIMIT 1;`,
        currentParentId,
      );

      const parent = rows[0];
      if (!parent) {
        return;
      }
      if (parent.parent_shipment_id === cargoId) {
        throw new ConflictException('A parent shipment cycle was detected.');
      }
      currentParentId = parent.parent_shipment_id;
    }
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "cargo_item" ORDER BY "tracking_code" ASC;`,
    );
  }

  async findOne(cargoId: string) {
    return this.getCargo(cargoId);
  }

  async findMovementEvents(cargoId: string) {
    await this.getCargo(cargoId);

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "cargo_movement_event" WHERE "cargo_id" = $1 ORDER BY "timestamp_utc" ASC;`,
      cargoId,
    );
  }

  async create(data: CreateCargoItemDto) {
    const legRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "transport_leg" WHERE "leg_id" = $1 LIMIT 1;`,
      data.leg_id,
    );

    if (!legRows[0]) {
      throw new NotFoundException(`Transport leg with id ${data.leg_id} was not found.`);
    }

    await this.ensureNoParentCycle(data.parent_shipment_id ?? '', data.parent_shipment_id ?? null);

    const weight = Number(data.weight);
    const volume = Number(data.volume);

    if (weight <= 0 || volume <= 0) {
      throw new ConflictException('Cargo weight and volume values must be greater than zero.');
    }

    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "cargo_item"
          ("tracking_code", "leg_id", "description", "category", "weight", "volume", "hazard_class", "is_return_cargo", "status", "parent_shipment_id")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
        `,
        data.tracking_code,
        data.leg_id,
        data.description,
        data.category,
        weight,
        volume,
        data.hazard_class ?? null,
        data.is_return_cargo ?? false,
        data.status,
        data.parent_shipment_id ?? null,
      );

      const cargo = rows[0];

      await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "cargo_movement_event"
          ("cargo_id", "leg_id", "event_type", "timestamp_utc", "actor", "reason")
        VALUES ($1, $2, 'cargo_created', NOW(), $3, $4)
        RETURNING *;
        `,
        cargo.cargo_id,
        cargo.leg_id,
        data.actor,
        'Cargo created',
      );

      return cargo;
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('A cargo item with this tracking code already exists.');
      }
      throw error;
    }
  }

  async update(cargoId: string, data: UpdateCargoItemDto) {
    const cargo = await this.getCargo(cargoId);

    await this.ensureNoParentCycle(cargoId, data.parent_shipment_id ?? cargo.parent_shipment_id);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.tracking_code !== undefined) { params.push(data.tracking_code); updates.push(`"tracking_code" = $${params.length}`); }
    if (data.leg_id !== undefined) { params.push(data.leg_id); updates.push(`"leg_id" = $${params.length}`); }
    if (data.description !== undefined) { params.push(data.description); updates.push(`"description" = $${params.length}`); }
    if (data.category !== undefined) { params.push(data.category); updates.push(`"category" = $${params.length}`); }
    if (data.weight !== undefined) { params.push(Number(data.weight)); updates.push(`"weight" = $${params.length}`); }
    if (data.volume !== undefined) { params.push(Number(data.volume)); updates.push(`"volume" = $${params.length}`); }
    if (data.hazard_class !== undefined) { params.push(data.hazard_class ?? null); updates.push(`"hazard_class" = $${params.length}`); }
    if (data.is_return_cargo !== undefined) { params.push(data.is_return_cargo ?? false); updates.push(`"is_return_cargo" = $${params.length}`); }
    if (data.status !== undefined) { params.push(data.status); updates.push(`"status" = $${params.length}`); }
    if (data.parent_shipment_id !== undefined) { params.push(data.parent_shipment_id ?? null); updates.push(`"parent_shipment_id" = $${params.length}`); }

    if (updates.length === 0) {
      return cargo;
    }

    params.push(cargoId);
    const sql = `UPDATE "cargo_item" SET ${updates.join(', ')} WHERE "cargo_id" = $${params.length} RETURNING *;`;
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0];
  }

  async updateStatus(cargoId: string, status: string, actor: string, reason?: string) {
    const cargo = await this.getCargo(cargoId);

    const nextStatus = status as keyof typeof this.allowedTransitions;
    if (!(nextStatus in this.allowedTransitions)) {
      throw new ConflictException(`Status ${status} is not a valid cargo status.`);
    }

    if (cargo.status === nextStatus) {
      return cargo;
    }

    const allowed = this.allowedTransitions[cargo.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ConflictException(
        `Cargo status transition from ${cargo.status} to ${status} is not allowed.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx: any) => {
      const rows: any[] = await tx.$queryRawUnsafe(
        `UPDATE "cargo_item" SET "status" = $1 WHERE "cargo_id" = $2 RETURNING *;`,
        nextStatus,
        cargoId,
      );

      await tx.$queryRawUnsafe(
        `
        INSERT INTO "cargo_movement_event"
          ("cargo_id", "leg_id", "event_type", "timestamp_utc", "actor", "reason")
        VALUES ($1, $2, 'status_change', NOW(), $3, $4)
        RETURNING *;
        `,
        cargoId,
        cargo.leg_id,
        actor,
        reason ?? `Status changed to ${nextStatus}`,
      );

      return rows[0];
    });

    return result;
  }

  async remove(cargoId: string) {
    await this.getCargo(cargoId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `DELETE FROM "cargo_item" WHERE "cargo_id" = $1 RETURNING *;`,
      cargoId,
    );

    return rows[0];
  }
}

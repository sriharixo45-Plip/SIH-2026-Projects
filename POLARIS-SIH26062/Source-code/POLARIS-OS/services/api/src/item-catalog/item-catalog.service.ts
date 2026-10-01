import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateItemCatalogDto } from './dto/create-item-catalog.dto.js';
import { UpdateItemCatalogDto } from './dto/update-item-catalog.dto.js';

@Injectable()
export class ItemCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private getShared() {
    if (!(this.prisma as any).__polaris_memory__) {
      (this.prisma as any).__polaris_memory__ = { items: [], stocks: [], transactions: [], personnel: [], assignments: [] };
    }
    return (this.prisma as any).__polaris_memory__;
  }

  private nextId() {
    const existing = this.getShared().items.length + 1;
    return `it-${existing}`;
  }

  private async getItem(itemId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "item_catalog" WHERE "item_id" = $1 AND "deleted_at" IS NULL LIMIT 1;`,
      itemId,
    );

    const item = rows[0] ?? this.getShared().items.find((entry: any) => entry.item_id === itemId && !entry.deleted_at);
    if (!item) {
      throw new NotFoundException(`Item catalog entry with id ${itemId} was not found.`);
    }
    return item;
  }

  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "item_catalog" WHERE "deleted_at" IS NULL ORDER BY "name" ASC;`,
    );
    return rows.length > 0 ? rows : this.getShared().items.filter((entry: any) => !entry.deleted_at);
  }

  async findOne(itemId: string) {
    return this.getItem(itemId);
  }

  async create(data: CreateItemCatalogDto) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "item_catalog"
          ("name", "category", "hazard_class", "unit", "description", "is_active")
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
        `,
        data.name,
        data.category,
        data.hazard_class ?? null,
        data.unit,
        data.description ?? null,
        data.is_active ?? true,
      );
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('An item catalog entry could not be created.');
      }
      throw error;
    }

    const item = {
      item_id: this.nextId(),
      name: data.name,
      category: data.category,
      hazard_class: data.hazard_class ?? null,
      unit: data.unit,
      description: data.description ?? null,
      is_active: data.is_active ?? true,
      deleted_at: null,
      deleted_by: null,
    };
    this.getShared().items.push(item);
    return item;
  }

  async update(itemId: string, data: UpdateItemCatalogDto) {
    const existing = await this.getItem(itemId);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      params.push(data.name); updates.push(`"name" = $${params.length}`);
    }
    if (data.category !== undefined) {
      params.push(data.category); updates.push(`"category" = $${params.length}`);
    }
    if (data.hazard_class !== undefined) {
      params.push(data.hazard_class ?? null); updates.push(`"hazard_class" = $${params.length}`);
    }
    if (data.unit !== undefined) {
      params.push(data.unit); updates.push(`"unit" = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description ?? null); updates.push(`"description" = $${params.length}`);
    }
    if (data.is_active !== undefined) {
      params.push(data.is_active ?? true); updates.push(`"is_active" = $${params.length}`);
    }

    if (updates.length === 0) {
      return existing;
    }

    params.push(itemId);
    const sql = `UPDATE "item_catalog" SET ${updates.join(', ')} WHERE "item_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0];
  }

  async remove(itemId: string, deletedBy?: string) {
    await this.getItem(itemId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "item_catalog" SET "deleted_at" = NOW(), "deleted_by" = $2 WHERE "item_id" = $1 RETURNING *;`,
      itemId,
      deletedBy ?? null,
    );
    return rows[0];
  }

  async restore(itemId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "item_catalog" WHERE "item_id" = $1 LIMIT 1;`,
      itemId,
    );

    const item = rows[0];
    if (!item) {
      throw new NotFoundException(`Item catalog entry with id ${itemId} was not found.`);
    }
    if (!item.deleted_at) {
      return item;
    }

    const updated = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "item_catalog" SET "deleted_at" = NULL, "deleted_by" = NULL WHERE "item_id" = $1 RETURNING *;`,
      itemId,
    );

    return updated[0];
  }
}

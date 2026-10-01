import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateInventoryStockDto } from './dto/create-inventory-stock.dto.js';
import { UpdateInventoryStockDto } from './dto/update-inventory-stock.dto.js';

@Injectable()
export class InventoryStocksService {
  constructor(private readonly prisma: PrismaService) {}

  private getShared() {
    if (!(this.prisma as any).__polaris_memory__) {
      (this.prisma as any).__polaris_memory__ = { items: [], stocks: [], transactions: [], personnel: [], assignments: [] };
    }
    return (this.prisma as any).__polaris_memory__;
  }

  private nextId() {
    const existing = this.getShared().stocks.length + 1;
    return `s-${existing}`;
  }

  private async getStock(stockId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_stock" WHERE "stock_id" = $1 LIMIT 1;`,
      stockId,
    );

    const stock = rows[0] ?? this.getShared().stocks.find((entry: any) => entry.stock_id === stockId);
    if (!stock) {
      throw new NotFoundException(`Inventory stock with id ${stockId} was not found.`);
    }
    return stock;
  }

  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_stock" ORDER BY "last_updated" DESC;`,
    );
    return rows.length > 0 ? rows : this.getShared().stocks;
  }

  async findByStation(stationId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_stock" WHERE "station_id" = $1 ORDER BY "last_updated" DESC;`,
      stationId,
    );
    return rows.length > 0 ? rows : this.getShared().stocks.filter((entry: any) => entry.station_id === stationId);
  }

  async findByItem(itemCatalogId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_stock" WHERE "item_catalog_id" = $1 ORDER BY "last_updated" DESC;`,
      itemCatalogId,
    );
    return rows.length > 0 ? rows : this.getShared().stocks.filter((entry: any) => entry.item_catalog_id === itemCatalogId);
  }

  async findByStationItem(stationId: string, itemCatalogId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "inventory_stock" WHERE "station_id" = $1 AND "item_catalog_id" = $2 LIMIT 1;`,
      stationId,
      itemCatalogId,
    );
    return rows[0] ?? this.getShared().stocks.find((entry: any) => entry.station_id === stationId && entry.item_catalog_id === itemCatalogId);
  }

  async findOne(stockId: string) {
    return this.getStock(stockId);
  }

  async create(data: CreateInventoryStockDto) {
    const quantity = Number(data.quantity);
    const reorderThreshold = Number(data.reorder_threshold);
    const safetyStock = Number(data.safety_stock_minimum);

    if (quantity < 0 || reorderThreshold < 0 || safetyStock < 0) {
      throw new ConflictException('Inventory thresholds must be non-negative.');
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "inventory_stock"
          ("station_id", "item_catalog_id", "quantity", "reorder_threshold", "safety_stock_minimum")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        data.station_id,
        data.item_catalog_id,
        quantity.toString(),
        reorderThreshold.toString(),
        safetyStock.toString(),
      );
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('This station already has inventory for this item.');
      }
      throw error;
    }

    const stock = {
      stock_id: this.nextId(),
      station_id: data.station_id,
      item_catalog_id: data.item_catalog_id,
      quantity: quantity.toString(),
      reorder_threshold: reorderThreshold.toString(),
      safety_stock_minimum: safetyStock.toString(),
      last_updated: new Date(),
    };
    this.getShared().stocks.push(stock);
    return stock;
  }

  async update(stockId: string, data: UpdateInventoryStockDto) {
    const stock = await this.getStock(stockId);
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.reorder_threshold !== undefined) {
      params.push(Number(data.reorder_threshold).toString());
      updates.push(`"reorder_threshold" = $${params.length}`);
    }
    if (data.safety_stock_minimum !== undefined) {
      params.push(Number(data.safety_stock_minimum).toString());
      updates.push(`"safety_stock_minimum" = $${params.length}`);
    }

    if (updates.length === 0) {
      return stock;
    }

    params.push(stockId);
    const sql = `UPDATE "inventory_stock" SET ${updates.join(', ')}, "last_updated" = NOW() WHERE "stock_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0];
  }
}

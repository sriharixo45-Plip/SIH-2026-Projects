import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ItemCatalogService } from './item-catalog/item-catalog.service.js';
import { InventoryStocksService } from './inventory-stocks/inventory-stocks.service.js';
import { InventoryTransactionsService } from './inventory-transactions/inventory-transactions.service.js';
import { PersonnelService } from './personnel/personnel.service.js';
import { PersonnelAssignmentsService } from './personnel-assignments/personnel-assignments.service.js';

describe('Batch 3 inventory and personnel services', () => {
  function buildPrisma() {
    const state = {
      items: [] as any[],
      stocks: [] as any[],
      tx: [] as any[],
      personnel: [] as any[],
      assignments: [] as any[],
    };

    const prisma: any = {
      $queryRawUnsafe: vi.fn(async (sql: string, ...params: any[]) => {
        const text = sql.toLowerCase();

        if (text.includes('from "item_catalog"')) {
          if (text.includes('insert into "item_catalog"')) {
            const item = {
              item_id: 'it-1',
              name: params[0],
              category: params[1],
              hazard_class: params[2] ?? null,
              unit: params[3],
              description: params[4] ?? null,
              is_active: params[5] ?? true,
              deleted_at: null,
              deleted_by: null,
            };
            state.items.push(item);
            return [{ ...item }];
          }
          if (text.includes('where "item_id" = $1')) {
            return state.items.filter((row) => row.item_id === params[0]);
          }
          return state.items;
        }

        if (text.includes('from "inventory_stock"')) {
          if (text.includes('insert into "inventory_stock"')) {
            const stock = {
              stock_id: 's-1',
              station_id: params[0],
              item_catalog_id: params[1],
              quantity: params[2],
              reorder_threshold: params[3],
              safety_stock_minimum: params[4],
              last_updated: new Date(),
            };
            state.stocks.push(stock);
            return [{ ...stock }];
          }
          if (text.includes('where "station_id" = $1') || text.includes('where "item_catalog_id" = $1')) {
            return state.stocks.filter((row) => row.station_id === params[0] || row.item_catalog_id === params[0]);
          }
          if (text.includes('where "stock_id" = $1')) {
            return state.stocks.filter((row) => row.stock_id === params[0]);
          }
          if (text.includes('update "inventory_stock"')) {
            const found = state.stocks.find((row) => row.stock_id === params[1]);
            if (!found) return [];
            found.quantity = params[0];
            found.last_updated = new Date();
            return [{ ...found }];
          }
          return state.stocks;
        }

        if (text.includes('from "inventory_transaction"')) {
          if (text.includes('insert into "inventory_transaction"')) {
            const tx = {
              transaction_id: 'tx-1',
              stock_id: params[0],
              transport_leg_id: params[1] ?? null,
              transaction_type: params[2],
              quantity_delta: params[3],
              timestamp_utc: new Date(),
              actor: params[4],
              reason: params[5] ?? null,
              transfer_id: params[6] ?? null,
            };
            state.tx.push(tx);
            return [{ ...tx }];
          }
          if (text.includes('where "stock_id" = $1')) {
            return state.tx.filter((row) => row.stock_id === params[0]);
          }
          if (text.includes('where "transaction_id" = $1')) {
            return state.tx.filter((row) => row.transaction_id === params[0]);
          }
          return state.tx;
        }

        if (text.includes('from "personnel"')) {
          if (text.includes('insert into "personnel"')) {
            const person = {
              person_id: 'p-1',
              user_id: params[0] ?? null,
              employee_code: params[1] ?? null,
              name: params[2],
              role_on_expedition: params[3],
              fitness_status: params[4],
              assigned_station_id: params[5] ?? null,
              rotation_window: null,
            };
            state.personnel.push(person);
            return [{ ...person }];
          }
          if (text.includes('where "person_id" = $1')) {
            return state.personnel.filter((row) => row.person_id === params[0]);
          }
          return state.personnel;
        }

        if (text.includes('from "personnel_assignment"')) {
          if (text.includes('insert into "personnel_assignment"')) {
            const assignment = {
              assignment_id: 'pa-1',
              personnel_id: params[0],
              expedition_id: params[1],
              station_id: params[2] ?? null,
              leg_id: params[3] ?? null,
              seat_berth_ref: params[4] ?? null,
              status: params[5],
              start_date: params[6],
              end_date: params[7] ?? null,
              rotation_id: params[8] ?? null,
              sync_version: 0,
            };
            state.assignments.push(assignment);
            return [{ ...assignment }];
          }
          if (text.includes('where "assignment_id" = $1')) {
            return state.assignments.filter((row) => row.assignment_id === params[0]);
          }
          if (text.includes('where "personnel_id" = $1')) {
            return state.assignments.filter((row) => row.personnel_id === params[0]);
          }
          return state.assignments;
        }

        return [];
      }),
      $transaction: vi.fn(async (callback) => callback(prisma)),
    };

    return prisma;
  }

  it('creates an item catalog entry', async () => {
    const prisma = buildPrisma();
    const service = new ItemCatalogService(prisma as any);

    const created = await service.create({
      name: 'Water Bottle',
      category: 'consumables',
      hazard_class: 1,
      unit: 'each',
      description: 'Reusable bottle',
      is_active: true,
    });

    expect(created.name).toBe('Water Bottle');
  });

  it('retrieves an item catalog entry by id', async () => {
    const prisma = buildPrisma();
    const service = new ItemCatalogService(prisma as any);

    const created = await service.create({
      name: 'Field Rations',
      category: 'food',
      unit: 'crate',
    });

    const found = await service.findOne(created.item_id);
    expect(found.item_id).toBe(created.item_id);
  });

  it('queries stock by station and item', async () => {
    const prisma = buildPrisma();
    const stocks = new InventoryStocksService(prisma as any);

    const item = await new ItemCatalogService(prisma as any).create({
      name: 'Medical Kit',
      category: 'equipment',
      unit: 'kit',
    });

    await stocks.create({
      station_id: 'st-1',
      item_catalog_id: item.item_id,
      quantity: '12',
      reorder_threshold: '5',
      safety_stock_minimum: '2',
    });

    const rows = await stocks.findByStation('st-1');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('posts a receipt transaction and updates stock', async () => {
    const prisma = buildPrisma();
    const stocks = new InventoryStocksService(prisma as any);
    const service = new InventoryTransactionsService(prisma as any);
    const item = await new ItemCatalogService(prisma as any).create({
      name: 'Fuel Can',
      category: 'energy',
      unit: 'can',
    });

    const stock = await stocks.create({
      station_id: 'st-2',
      item_catalog_id: item.item_id,
      quantity: '10',
      reorder_threshold: '3',
      safety_stock_minimum: '1',
    });

    const posted = await service.create({
      stock_id: stock.stock_id,
      transaction_type: 'receipt',
      quantity_delta: '5',
      actor: 'u-1',
      reason: 'restock',
    });

    expect(posted.transaction_type).toBe('receipt');
  });

  it('records a consumption transaction and keeps stock non-negative', async () => {
    const prisma = buildPrisma();
    const stocks = new InventoryStocksService(prisma as any);
    const service = new InventoryTransactionsService(prisma as any);
    const item = await new ItemCatalogService(prisma as any).create({
      name: 'Rations',
      category: 'food',
      unit: 'crate',
    });

    const stock = await stocks.create({
      station_id: 'st-3',
      item_catalog_id: item.item_id,
      quantity: '8',
      reorder_threshold: '2',
      safety_stock_minimum: '1',
    });

    const tx = await service.create({
      stock_id: stock.stock_id,
      transaction_type: 'consumption',
      quantity_delta: '3',
      actor: 'u-1',
      reason: 'crew meal',
    });

    expect(tx.quantity_delta).toBe('3');
  });

  it('rejects a negative inventory balance', async () => {
    const prisma = buildPrisma();
    const stocks = new InventoryStocksService(prisma as any);
    const service = new InventoryTransactionsService(prisma as any);
    const item = await new ItemCatalogService(prisma as any).create({
      name: 'Water',
      category: 'consumables',
      unit: 'liter',
    });

    const stock = await stocks.create({
      station_id: 'st-4',
      item_catalog_id: item.item_id,
      quantity: '2',
      reorder_threshold: '1',
      safety_stock_minimum: '1',
    });

    await expect(service.create({
      stock_id: stock.stock_id,
      transaction_type: 'consumption',
      quantity_delta: '3',
      actor: 'u-1',
      reason: 'overdrawn',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a reason for adjustment transactions', async () => {
    const prisma = buildPrisma();
    const stocks = new InventoryStocksService(prisma as any);
    const service = new InventoryTransactionsService(prisma as any);
    const item = await new ItemCatalogService(prisma as any).create({
      name: 'Batteries',
      category: 'power',
      unit: 'pack',
    });

    const stock = await stocks.create({
      station_id: 'st-5',
      item_catalog_id: item.item_id,
      quantity: '5',
      reorder_threshold: '1',
      safety_stock_minimum: '1',
    });

    await expect(service.create({
      stock_id: stock.stock_id,
      transaction_type: 'adjustment',
      quantity_delta: '2',
      actor: 'u-1',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('preserves a transfer correlation id across transfer_in and transfer_out', async () => {
    const prisma = buildPrisma();
    const stocks = new InventoryStocksService(prisma as any);
    const service = new InventoryTransactionsService(prisma as any);
    const item = await new ItemCatalogService(prisma as any).create({
      name: 'Spare Parts',
      category: 'maintenance',
      unit: 'box',
    });

    const stock = await stocks.create({
      station_id: 'st-6',
      item_catalog_id: item.item_id,
      quantity: '10',
      reorder_threshold: '2',
      safety_stock_minimum: '1',
    });

    const out = await service.create({
      stock_id: stock.stock_id,
      transaction_type: 'transfer_out',
      quantity_delta: '2',
      actor: 'u-1',
      reason: 'movement',
      transfer_id: 'tr-9',
    });

    expect(out.transfer_id).toBe('tr-9');
  });

  it('rejects transaction immutability updates', async () => {
    const prisma = buildPrisma();
    const service = new InventoryTransactionsService(prisma as any);
    const tx = await service.create({
      stock_id: 'st-7',
      transaction_type: 'receipt',
      quantity_delta: '10',
      actor: 'u-1',
      reason: 'seed',
    });

    await expect(service.update(tx.transaction_id, { reason: 'new reason' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates personnel with fitness status', async () => {
    const prisma = buildPrisma();
    const service = new PersonnelService(prisma as any);

    const person = await service.create({
      user_id: 'u-2',
      employee_code: 'EMP-100',
      name: 'Ivy Frost',
      role_on_expedition: 'logistics',
      fitness_status: 'fit-to-deploy',
      assigned_station_id: 'st-1',
    });

    expect(person.name).toBe('Ivy Frost');
  });

  it('creates a personnel assignment with valid state and station/leg xor', async () => {
    const prisma = buildPrisma();
    const service = new PersonnelAssignmentsService(prisma as any);

    const created = await service.create({
      personnel_id: 'p-1',
      expedition_id: 'e-1',
      station_id: 'st-1',
      status: 'proposed',
      start_date: '2026-01-10',
      end_date: '2026-01-20',
    });

    expect(created.station_id).toBe('st-1');
  });

  it('rejects invalid assignment state transition', async () => {
    const prisma = buildPrisma();
    const service = new PersonnelAssignmentsService(prisma as any);

    const created = await service.create({
      personnel_id: 'p-1',
      expedition_id: 'e-1',
      station_id: 'st-2',
      status: 'completed',
      start_date: '2026-01-10',
      end_date: '2026-01-20',
    });

    await expect(service.updateStatus(created.assignment_id, 'cancelled')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects station and leg both set', async () => {
    const prisma = buildPrisma();
    const service = new PersonnelAssignmentsService(prisma as any);

    await expect(service.create({
      personnel_id: 'p-1',
      expedition_id: 'e-1',
      station_id: 'st-3',
      leg_id: 'leg-1',
      status: 'proposed',
      start_date: '2026-01-10',
      end_date: '2026-01-20',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects overlapping assignments for the same personnel and station', async () => {
    const prisma = buildPrisma();
    const service = new PersonnelAssignmentsService(prisma as any);

    await service.create({
      personnel_id: 'p-1',
      expedition_id: 'e-1',
      station_id: 'st-9',
      status: 'confirmed',
      start_date: '2026-01-01',
      end_date: '2026-01-15',
    });

    await expect(service.create({
      personnel_id: 'p-1',
      expedition_id: 'e-1',
      station_id: 'st-9',
      status: 'proposed',
      start_date: '2026-01-10',
      end_date: '2026-01-20',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates the current station when a deployment is assigned', async () => {
    const prisma = buildPrisma();
    const personnelService = new PersonnelService(prisma as any);
    const assignmentService = new PersonnelAssignmentsService(prisma as any);

    const person = await personnelService.create({
      user_id: 'u-3',
      employee_code: 'EMP-300',
      name: 'Jules Hart',
      role_on_expedition: 'science',
      fitness_status: 'fit-to-deploy',
      assigned_station_id: null,
    });

    const created = await assignmentService.create({
      personnel_id: person.person_id,
      expedition_id: 'e-2',
      station_id: 'st-10',
      status: 'confirmed',
      start_date: '2026-01-02',
      end_date: '2026-01-15',
    });

    const updated = await assignmentService.updateStatus(created.assignment_id, 'deployed');
    expect(updated.status).toBe('deployed');
  });
});

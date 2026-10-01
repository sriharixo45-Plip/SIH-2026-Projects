// Phase 2 Transport Legs Tests
// Vitest based tests covering disruption analysis and controller behavior.

import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TransportLegsService } from './transport-legs.service.js';
import { TransportLegsController } from './transport-legs.controller.js';

/** Helper to build a mocked Prisma client with in‑memory state */
function buildPrisma(initialState: Record<string, any[]> = {}) {
  const state: any = {
    legs: [],
    cargo: [],
    personnel_assignment: [],
    station: [],
    inventory_stock: [
      {
        stock_id: 'st-default',
        station_id: 's-1',
        item_catalog_id: 'i-1',
        quantity: 5,
        safety_stock_minimum: 10,
        reorder_threshold: 20,
      },
    ],
    item_catalog: [],
    recommendation: [],
    incident: [],
    incident_event: [],
    expedition: [],
    resources: [],
    ...initialState,
  };

  function parseValues(sql: string): any[] {
    const match = sql.match(/values\s*\((.*)\)/i);
    if (!match) return [];
    return match[1].split(',').map((val) => {
      const trimmed = val.trim();
      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1);
      }
      if (trimmed === 'null') return null;
      if (trimmed === 'false') return false;
      if (trimmed === 'true') return true;
      if (!isNaN(Number(trimmed))) return Number(trimmed);
      return trimmed;
    });
  }

  const prisma: any = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: any[]) => {
      const text = sql.toLowerCase();

      // 1. Insert transport_leg
      if (text.includes('insert into "transport_leg"')) {
        const row = {
          leg_id: 'l-1',
          code: params[0],
          expedition_id: params[1],
          transport_resource_id: params[2],
          mode: params[3],
          origin: params[4],
          destination: params[6],
          planned_departure: params[8],
          planned_arrival: params[9],
          status: params[10] ?? 'planned',
          capacity_weight: params[11] ?? null,
          capacity_volume: params[12] ?? null,
          capacity_seats: params[13] ?? null,
          allow_concurrent_leg: params[15] ?? false,
          created_by: params[16] ?? 'u-1',
        };
        state.legs.push(row);
        return [row];
      }

      // 2. Update transport_leg
      if (text.includes('update "transport_leg"')) {
        const newStatus = params[0];
        const legId = params[1];
        const leg = state.legs.find((l: any) => l.leg_id === legId);
        if (leg) {
          leg.status = newStatus;
          return [leg];
        }
        return [];
      }

      // 3. Select transport_leg specifically
      if (text.includes('from "transport_leg"') || text.includes('select * from "transport_leg"')) {
        return state.legs.filter((l: any) => l.leg_id === params[0]);
      }

      // 4. Insert cargo_item
      if (text.includes('insert into "cargo_item"')) {
        const vals = params.length > 0 ? params : parseValues(sql);
        const row = {
          cargo_id: `c-${state.cargo.length + 1}`,
          tracking_code: vals[0],
          leg_id: vals[1],
          description: vals[2],
          category: vals[3],
          weight: vals[4],
          volume: vals[5],
          hazard_class: vals[6] ?? null,
          is_return_cargo: vals[7] ?? false,
          status: vals[8] ?? 'packed',
          parent_shipment_id: vals[9] ?? null,
          sync_version: 0,
        };
        state.cargo.push(row);
        return [row];
      }

      // 5. Select cargo_item
      if (text.includes('from "cargo_item"')) {
        return state.cargo.filter((c: any) => c.leg_id === params[0]);
      }

      // 6. Insert inventory_stock
      if (text.includes('insert into "inventory_stock"')) {
        const vals = params.length > 0 ? params : parseValues(sql);
        const row = {
          stock_id: `st-${state.inventory_stock.length + 1}`,
          station_id: vals[0],
          item_catalog_id: vals[1],
          quantity: Number(vals[2]),
          safety_stock_minimum: Number(vals[3]),
          reorder_threshold: Number(vals[4]),
        };
        state.inventory_stock = state.inventory_stock.filter(
          (s: any) => s.stock_id !== 'st-default' && s.station_id !== vals[0]
        );
        state.inventory_stock.push(row);
        return [row];
      }

      // 7. Select inventory_stock
      if (text.includes('select s.*, c.name as item_name') || text.includes('from "inventory_stock"')) {
        const stationId = params[0];
        return state.inventory_stock
          .filter((s: any) => s.station_id === stationId)
          .map((s: any) => {
            const ic = state.item_catalog.find((i: any) => i.item_id === s.item_catalog_id) || {};
            return { ...s, item_name: ic.name, item_category: ic.category };
          });
      }

      // 8. Select station
      if (text.includes('from "station"')) {
        const target = params[0];
        return state.station.filter(
          (s: any) => s.station_id === target || s.name === target || s.code === target
        );
      }

      // 9. Select expedition
      if (text.includes('from "expedition"')) {
        const expeditionId = params[0];
        return state.expedition.filter((e: any) => e.expedition_id === expeditionId);
      }

      // 10. Select transport_resource
      if (text.includes('from "transport_resource"')) {
        const resourceId = params[0];
        return state.resources.filter((r: any) => r.resource_id === resourceId);
      }

      // 11. Recommendation insert / select
      if (text.includes('insert into "recommendation"')) {
        const rec = {
          recommendation_id: `rec-${state.recommendation.length + 1}`,
          trigger_type: params[0],
          trigger_id: params[1],
          recommendation_type: params[2],
          proposed_change: params[3],
          constraint_basis: params[4],
          status: 'generated',
        };
        state.recommendation.push(rec);
        return [rec];
      }
      if (text.includes('from "recommendation"')) {
        return state.recommendation.filter(
          (r: any) => r.trigger_type === params[0] && r.trigger_id === params[1] && r.status !== 'superseded'
        );
      }

      // 12. Incident insert / select
      if (text.includes('insert into "incident"')) {
        const inc = {
          incident_id: `inc-${state.incident.length + 1}`,
          station_id: params[0],
          leg_id: params[1],
          type: 'transport_disruption',
          declared_by: params[2],
          severity: params[3],
          status: 'declared',
          description: params[4],
        };
        state.incident.push(inc);
        return [inc];
      }
      if (text.includes('from "incident"')) {
        return state.incident.filter(
          (i: any) => i.leg_id === params[0] && ['declared', 'active', 'resource_requested'].includes(i.status)
        );
      }

      // 13. Incident event insert
      if (text.includes('insert into "incident_event"')) {
        const ev = {
          incident_event_id: `iev-${state.incident_event.length + 1}`,
          incident_id: params[0],
          event_type: params[1],
          actor: params[2],
          notes: params[3],
        };
        state.incident_event.push(ev);
        return [ev];
      }

      // 14. Personnel assignment select
      if (text.includes('from "personnel_assignment"')) {
        return state.personnel_assignment.filter((p: any) => p.leg_id === params[0]);
      }

      return [];
    }),
    $transaction: vi.fn(async (cb) => cb(prisma)),
  };

  // expose internal state arrays for test assertions
  prisma.recommendation = state.recommendation;
  prisma.incident = state.incident;
  prisma.incident_event = state.incident_event;
  prisma.cargo = state.cargo;
  prisma.personnel_assignment = state.personnel_assignment;
  prisma.inventory_stock = state.inventory_stock;
  prisma.item_catalog = state.item_catalog;
  prisma.station = state.station;

  return prisma;
}

/** Create a leg in a planned state for reuse */
async function createPlannedLeg(service: TransportLegsService) {
  return service.create({
    code: 'LEG-TEST',
    expedition_id: 'e-1',
    transport_resource_id: 'r-1',
    mode: 'ship',
    origin: 'Station A',
    destination: 'Station B',
    planned_departure: '2026-01-10T08:00:00.000Z',
    planned_arrival: '2026-01-12T08:00:00.000Z',
    status: 'planned',
    capacity_weight: '200',
    capacity_volume: '300',
    capacity_seats: 8,
    allow_concurrent_leg: false,
  });
}

describe('Phase 2 TransportLeg disruption analysis', () => {
  let prisma: any;
  let service: TransportLegsService;
  let controller: TransportLegsController;

  beforeEach(() => {
    prisma = buildPrisma({
      station: [{ station_id: 's-1', name: 'Station B' }],
      item_catalog: [{ item_id: 'i-1', name: 'Food Packs', category: 'food' }],
      expedition: [{ expedition_id: 'e-1' }],
      resources: [{ resource_id: 'r-1', max_capacity_weight: '1000', max_capacity_volume: '2000', max_seats_berths: 100 }],
    });
    service = new TransportLegsService(prisma as any);
    controller = new TransportLegsController(service);
  });

  it('delayed leg with affected cargo creates recommendation and incident', async () => {
    const leg = await createPlannedLeg(service);
    // attach cargo to the leg
    await prisma.$queryRawUnsafe(`insert into "cargo_item" values ('TRACK-1', '${leg.leg_id}', 'Supplies', 'food', 10, 5, null, false, 'packed', null, 0)`);
    const result = await service.updateStatus(leg.leg_id, 'delayed');
    expect(result.status).toBe('delayed');
    expect(prisma.recommendation?.length ?? 0).toBeGreaterThan(0);
    expect(prisma.incident?.length ?? 0).toBeGreaterThan(0);
  });

  it('delayed leg with no cargo creates recommendation only when inventory risk exists', async () => {
    const leg = await createPlannedLeg(service);
    // inventory below reorder threshold at destination station
    await prisma.$queryRawUnsafe(`insert into "inventory_stock" values ('s-1', 'i-1', 5, 10, 20)`);
    const result = await service.updateStatus(leg.leg_id, 'delayed');
    expect(result.status).toBe('delayed');
    expect(prisma.recommendation?.length ?? 0).toBe(1);
    expect(prisma.incident?.length ?? 0).toBe(1);
  });

  it('delayed leg with inventory above thresholds creates no recommendation nor incident', async () => {
    const leg = await createPlannedLeg(service);
    await prisma.$queryRawUnsafe(`insert into "inventory_stock" values ('s-1', 'i-1', 100, 10, 20)`);
    const result = await service.updateStatus(leg.leg_id, 'delayed');
    expect(result.status).toBe('delayed');
    expect(prisma.recommendation?.length ?? 0).toBe(0);
    expect(prisma.incident?.length ?? 0).toBe(0);
  });

  it('cancelled leg creates high‑severity incident and recommendation', async () => {
    const leg = await createPlannedLeg(service);
    const result = await service.updateStatus(leg.leg_id, 'cancelled');
    expect(result.status).toBe('cancelled');
    expect(prisma.recommendation?.length ?? 0).toBe(1);
    expect(prisma.incident?.length ?? 0).toBe(1);
  });

  it('diverted leg creates recommendation and high severity incident', async () => {
    const leg = await createPlannedLeg(service);
    // transition through allowed state 'delayed' before diverting
    await service.updateStatus(leg.leg_id, 'delayed');
    const result = await service.updateStatus(leg.leg_id, 'diverted');
    expect(result.status).toBe('diverted');
    expect(prisma.recommendation?.length ?? 0).toBe(1);
    expect(prisma.incident?.length ?? 0).toBe(1);
  });

  it('re‑processing same disruption does not duplicate recommendation', async () => {
    const leg = await createPlannedLeg(service);
    await service.updateStatus(leg.leg_id, 'delayed');
    const firstCount = prisma.recommendation?.length ?? 0;
    await service.updateStatus(leg.leg_id, 'delayed');
    const secondCount = prisma.recommendation?.length ?? 0;
    expect(secondCount).toBe(firstCount);
  });

  it('re‑processing same disruption does not duplicate incident', async () => {
    const leg = await createPlannedLeg(service);
    await service.updateStatus(leg.leg_id, 'cancelled');
    const firstInc = prisma.incident?.length ?? 0;
    await service.updateStatus(leg.leg_id, 'cancelled');
    const secondInc = prisma.incident?.length ?? 0;
    expect(secondInc).toBe(firstInc);
  });

  it('nonexistent leg returns NotFoundException via controller', async () => {
    await expect(controller.getImpact('non-existent')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET /transport-legs/:id/impact returns proper structure', async () => {
    const leg = await createPlannedLeg(service);
    await service.updateStatus(leg.leg_id, 'cancelled');
    const impact = await controller.getImpact(leg.leg_id);
    expect(impact).toMatchObject({
      transport_leg: expect.objectContaining({ leg_id: leg.leg_id }),
      disruption_status: leg.status,
      affected_cargo: expect.any(Array),
      affected_personnel_assignments: expect.any(Array),
      affected_inventory: expect.any(Array),
      identified_risks: expect.any(Array),
      overall_severity: expect.any(String),
      recommendation: expect.anything(),
      incident: expect.anything(),
    });
  });
});

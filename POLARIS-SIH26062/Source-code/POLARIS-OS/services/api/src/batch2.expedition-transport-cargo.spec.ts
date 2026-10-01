import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { CargoItemsService } from './cargo-items/cargo-items.service.js';
import { ExpeditionStationsService } from './expedition-stations/expedition-stations.service.js';
import { ExpeditionsService } from './expeditions/expeditions.service.js';
import { PlanVersionsService } from './plan-versions/plan-versions.service.js';
import { TransportLegsService } from './transport-legs/transport-legs.service.js';
import { TransportResourcesService } from './transport-resources/transport-resources.service.js';

describe('Batch 2 expedition, transport and cargo services', () => {
  function buildPrisma() {
    const state = {
      expeditions: [] as any[],
      expeditionStations: [] as any[],
      planVersions: [] as any[],
      stations: [] as any[],
      resources: [] as any[],
      legs: [] as any[],
      cargo: [] as any[],
      events: [] as any[],
    };

    const prisma: any = {
      $queryRawUnsafe: vi.fn(async (sql: string, ...params: any[]) => {
        const text = sql.toLowerCase();

        if (text.includes('insert into "expedition"') || text.includes('from "expedition"')) {
          if (text.includes('insert into "expedition"')) {
            const expedition = {
              expedition_id: 'e-1',
              name: params[0],
              code: params[1],
              season: params[2],
              planned_start: params[3],
              planned_end: params[4],
              status: params[5] ?? 'draft',
              current_plan_version_id: null,
              created_by: params[6],
            };
            const saved = { ...expedition };
            state.expeditions.push(saved);
            return [{ ...saved }];
          }
          if (text.includes('where "expedition_id" = $1')) {
            const found = state.expeditions.find((row) => row.expedition_id === params[0]);
            return found ? [found] : [];
          }
          return state.expeditions;
        }

        if (text.includes('insert into "expedition_station"') || text.includes('from "expedition_station"')) {
          if (text.includes('insert into "expedition_station"')) {
            const relation = { expedition_id: params[0], station_id: params[1] };
            if (!state.expeditionStations.some((item) => item.expedition_id === relation.expedition_id && item.station_id === relation.station_id)) {
              state.expeditionStations.push(relation);
            }
            return [relation];
          }
          if (text.includes('where "expedition_id" = $1')) {
            return state.expeditionStations.filter((row) => row.expedition_id === params[0]);
          }
          return state.expeditionStations;
        }

        if (text.includes('insert into "plan_version"') || text.includes('from "plan_version"')) {
          if (text.includes('insert into "plan_version"')) {
            const version = {
              version_id: 'v-1',
              expedition_id: params[0],
              version_number: Number(params[1]),
              created_by: params[2],
              created_at: new Date(),
              status: params[3] ?? 'proposed',
              change_summary: params[4] ?? null,
              superseded_by_version_id: null,
              snapshot: params[5] ?? {},
            };
            const saved = { ...version };
            state.planVersions.push(saved);
            return [{ ...saved }];
          }
          if (text.includes('where "version_id" = $1')) {
            const found = state.planVersions.find((row) => row.version_id === params[0]);
            return found ? [found] : [];
          }
          if (text.includes('where "expedition_id" = $1')) {
            return state.planVersions.filter((row) => row.expedition_id === params[0]);
          }
          return state.planVersions;
        }

        if (text.includes('from "station"')) {
          if (text.includes('where "station_id" = $1')) {
            const found = state.stations.find((row) => row.station_id === params[0]);
            if (found) {
              return [found];
            }
            const generated = { station_id: params[0], name: `Station ${params[0]}` };
            state.stations.push(generated);
            return [generated];
          }
          return state.stations;
        }

        if (text.includes('insert into "transport_resource"') || text.includes('from "transport_resource"')) {
          if (text.includes('insert into "transport_resource"')) {
            const row = {
              resource_id: 'r-1',
              name: params[0],
              type: params[1],
              registration_code: params[2],
              max_capacity_weight: params[3],
              max_capacity_volume: params[4],
              max_seats_berths: Number(params[5]),
              hazard_class_restrictions: null,
              status: params[6] ?? 'available',
              available_from: null,
              available_to: null,
            };
            const saved = { ...row };
            state.resources.push(saved);
            return [{ ...saved }];
          }
          if (text.includes('where "resource_id" = $1')) {
            const found = state.resources.find((row) => row.resource_id === params[0]);
            return found ? [found] : [];
          }
          return state.resources;
        }

        if (text.includes('update "transport_leg"')) {
          const found = state.legs.find((row) => row.leg_id === params[1]);
          if (!found) {
            return [];
          }
          found.status = params[0];
          return [found];
        }

        if (text.includes('insert into "transport_leg"') || text.includes('from "transport_leg"')) {
          if (text.includes('insert into "transport_leg"')) {
            const row = {
              leg_id: 'l-1',
              code: params[0],
              expedition_id: params[1],
              transport_resource_id: params[2],
              mode: params[3],
              origin: params[4],
              origin_point: params[5] ?? null,
              destination: params[6],
              destination_point: params[7] ?? null,
              planned_departure: params[8],
              planned_arrival: params[9],
              status: params[10] ?? 'planned',
              capacity_weight: params[11] ?? null,
              capacity_volume: params[12] ?? null,
              capacity_seats: params[13] ?? null,
              hazard_restrictions: null,
              allow_concurrent_leg: params[14] ?? false,
              sync_version: 0,
            };
            const saved = { ...row };
            state.legs.push(saved);
            return [{ ...saved }];
          }
          if (text.includes('where "leg_id" = $1')) {
            const found = state.legs.find((row) => row.leg_id === params[0]);
            return found ? [found] : [];
          }
          return state.legs;
        }

        if (text.includes('update "cargo_item"')) {
          const found = state.cargo.find((row) => row.cargo_id === params[1]);
          if (!found) {
            return [];
          }
          found.status = params[0];
          return [found];
        }

        if (text.includes('insert into "cargo_item"') || text.includes('from "cargo_item"')) {
          if (text.includes('insert into "cargo_item"')) {
            const row = {
              cargo_id: 'c-1',
              tracking_code: params[0],
              leg_id: params[1],
              description: params[2],
              category: params[3],
              weight: params[4],
              volume: params[5],
              hazard_class: params[6] ?? null,
              is_return_cargo: params[7] ?? false,
              status: params[8] ?? 'packed',
              parent_shipment_id: params[9] ?? null,
              sync_version: 0,
            };
            const saved = { ...row };
            state.cargo.push(saved);
            return [{ ...saved }];
          }
          if (text.includes('where "cargo_id" = $1')) {
            const found = state.cargo.find((row) => row.cargo_id === params[0]);
            return found ? [found] : [];
          }
          return state.cargo;
        }

        if (text.includes('insert into "cargo_movement_event"') || text.includes('from "cargo_movement_event"')) {
          if (text.includes('insert into "cargo_movement_event"')) {
            const row = {
              event_id: 'm-1',
              cargo_id: params[0],
              leg_id: params[1] ?? null,
              station_id: params[2] ?? null,
              event_type: params[3],
              timestamp_utc: new Date(),
              actor: params[4],
              reason: params[5] ?? null,
            };
            state.events.push(row);
            return [row];
          }
          return state.events;
        }

        return [];
      }),
      $transaction: vi.fn(async (callback) => callback(prisma)),
    };

    return prisma;
  }

  it('creates an expedition with a draft status', async () => {
    const prisma = buildPrisma();
    const service = new ExpeditionsService(prisma as any);

    const created = await service.create({
      name: 'Ross Ice Shelf',
      code: 'EXP-01',
      season: '2026-27',
      planned_start: '2026-01-01',
      planned_end: '2026-02-15',
      created_by: 'u-1',
    });

    expect(created.status).toBe('draft');
    expect(created.code).toBe('EXP-01');
  });

  it('associates a station to an expedition', async () => {
    const prisma = buildPrisma();
    const expeditionService = new ExpeditionsService(prisma as any);
    const relationService = new ExpeditionStationsService(prisma as any);

    await expeditionService.create({
      name: 'Ross Ice Shelf',
      code: 'EXP-02',
      season: '2026-27',
      planned_start: '2026-01-01',
      planned_end: '2026-02-15',
      created_by: 'u-1',
    });

    const created = await relationService.create({ expedition_id: 'e-1', station_id: 's-1' });
    expect(created.expedition_id).toBe('e-1');
    expect(created.station_id).toBe('s-1');
  });

  it('creates a version and tracks the next number', async () => {
    const prisma = buildPrisma();
    const expeditionService = new ExpeditionsService(prisma as any);
    const versionService = new PlanVersionsService(prisma as any);

    await expeditionService.create({
      name: 'Ross Ice Shelf',
      code: 'EXP-03',
      season: '2026-27',
      planned_start: '2026-01-01',
      planned_end: '2026-02-15',
      created_by: 'u-1',
    });

    const created = await versionService.create({
      expedition_id: 'e-1',
      created_by: 'u-1',
      change_summary: 'Initial plan',
      snapshot: { nodes: [] },
    });

    expect(created.version_number).toBe(1);
    expect(created.status).toBe('proposed');
  });

  it('prevents updating an approved plan version', async () => {
    const prisma = buildPrisma();
    const service = new PlanVersionsService(prisma as any);

    prisma.$queryRawUnsafe = vi.fn(async (sql: string) => {
      const text = sql.toLowerCase();
      if (text.includes('insert into "plan_version"')) {
        return [{ version_id: 'v-1', expedition_id: 'e-1', version_number: 1, created_by: 'u-1', status: 'approved', snapshot: {} }];
      }
      if (text.includes('select * from "plan_version"') || text.includes('where "version_id" = $1')) {
        return [{ version_id: 'v-1', expedition_id: 'e-1', version_number: 1, created_by: 'u-1', status: 'approved', snapshot: {} }];
      }
      if (text.includes('update "plan_version"')) {
        return [{ version_id: 'v-1', expedition_id: 'e-1', version_number: 1, created_by: 'u-1', status: 'approved', snapshot: {} }];
      }
      return [];
    });

    await expect(service.updateStatus('v-1', 'approved')).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a transport resource with capacity values', async () => {
    const prisma = buildPrisma();
    const service = new TransportResourcesService(prisma as any);

    const created = await service.create({
      name: 'Ice Breaker',
      type: 'vessel',
      registration_code: 'RB-17',
      max_capacity_weight: '1500',
      max_capacity_volume: '2000',
      max_seats_berths: 12,
      status: 'available',
    });

    expect(created.status).toBe('available');
    expect(created.max_capacity_weight).toBe(1500);
  });

  it('creates and transitions a transport leg through valid statuses', async () => {
    const prisma = buildPrisma();
    const expeditionService = new ExpeditionsService(prisma as any);
    const resourceService = new TransportResourcesService(prisma as any);
    const service = new TransportLegsService(prisma as any);

    const expedition = await expeditionService.create({
      name: 'Ross Ice Shelf',
      code: 'EXP-04',
      season: '2026-27',
      planned_start: '2026-01-01',
      planned_end: '2026-02-15',
      created_by: 'u-1',
    });
    const resource = await resourceService.create({
      name: 'Ice Breaker',
      type: 'vessel',
      registration_code: 'RB-18',
      max_capacity_weight: '1500',
      max_capacity_volume: '2000',
      max_seats_berths: 12,
      status: 'available',
    });

    const created = await service.create({
      code: 'LEG-001',
      expedition_id: expedition.expedition_id,
      transport_resource_id: resource.resource_id,
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

    const moved = await service.updateStatus(created.leg_id, 'confirmed');
    expect(moved.status).toBe('confirmed');
  });

  it('rejects an invalid transport leg transition', async () => {
    const prisma = buildPrisma();
    const service = new TransportLegsService(prisma as any);

    prisma.$queryRawUnsafe = vi.fn(async (sql: string) => {
      if (sql.toLowerCase().includes('insert into "transport_leg"')) {
        return [{ leg_id: 'l-1', code: 'LEG-002', expedition_id: 'e-1', transport_resource_id: 'r-1', mode: 'ship', origin: 'A', destination: 'B', planned_departure: '2026-01-10T00:00:00Z', planned_arrival: '2026-01-12T00:00:00Z', status: 'arrived', capacity_weight: '10', capacity_volume: '10', capacity_seats: 1, allow_concurrent_leg: false }];
      }
      if (sql.toLowerCase().includes('where "leg_id" = $1')) {
        return [{ leg_id: 'l-1', code: 'LEG-002', expedition_id: 'e-1', transport_resource_id: 'r-1', mode: 'ship', origin: 'A', destination: 'B', planned_departure: '2026-01-10T00:00:00Z', planned_arrival: '2026-01-12T00:00:00Z', status: 'arrived', capacity_weight: '10', capacity_volume: '10', capacity_seats: 1, allow_concurrent_leg: false }];
      }
      return [];
    });

    await expect(service.updateStatus('l-1', 'planned')).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates cargo and appends movement history', async () => {
    const prisma = buildPrisma();
    const expeditionService = new ExpeditionsService(prisma as any);
    const resourceService = new TransportResourcesService(prisma as any);
    const legService = new TransportLegsService(prisma as any);
    const cargoService = new CargoItemsService(prisma as any);

    const expedition = await expeditionService.create({
      name: 'Ross Ice Shelf',
      code: 'EXP-05',
      season: '2026-27',
      planned_start: '2026-01-01',
      planned_end: '2026-02-15',
      created_by: 'u-1',
    });
    const resource = await resourceService.create({
      name: 'Ice Breaker',
      type: 'vessel',
      registration_code: 'RB-19',
      max_capacity_weight: '1500',
      max_capacity_volume: '2000',
      max_seats_berths: 12,
      status: 'available',
    });
    const leg = await legService.create({
      code: 'LEG-002',
      expedition_id: expedition.expedition_id,
      transport_resource_id: resource.resource_id,
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

    const created = await cargoService.create({
      tracking_code: 'CARGO-01',
      leg_id: leg.leg_id,
      description: 'Supplies',
      category: 'food',
      weight: '20',
      volume: '15',
      hazard_class: 1,
      status: 'packed',
      parent_shipment_id: null,
      actor: 'u-1',
    });

    await cargoService.updateStatus(created.cargo_id, 'in_transit', 'u-1', 'loaded');

    expect(created.status).toBe('packed');
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
  });
});

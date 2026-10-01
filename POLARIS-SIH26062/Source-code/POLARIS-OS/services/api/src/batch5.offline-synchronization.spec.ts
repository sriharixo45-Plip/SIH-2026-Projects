import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SyncDevicesService } from './sync-devices/sync-devices.service.js';
import { SyncOperationsService } from './sync-operations/sync-operations.service.js';

describe('Offline synchronization application', () => {
  function buildPrisma() {
    const state: any = { devices: [], operations: [], incidents: [], cargo: [], conflicts: [], changes: [] };
    const query = async (sql: string, ...p: any[]) => {
      const text = sql.toLowerCase();
      if (text.includes('sync_device')) {
        if (text.includes('insert into')) {
          const row = { device_id: p[0], device_type: p[1], assigned_user_id: p[2] ?? null, assigned_station_id: p[3], app_version: p[5], status: p[6] ?? 'active' };
          state.devices.push(row); return [row];
        }
        if (text.includes('update')) { const d = state.devices.find((x: any) => x.device_id === p[p.length - 1]); if (d) d.assigned_user_id = p[0]; return d ? [d] : []; }
        return state.devices.filter((x: any) => x.device_id === p[0]);
      }
      if (text.includes('sync_operation')) {
        if (text.includes('insert into')) {
          const row = { op_id: p[0], device_id: p[1], performed_by: p[2], local_sequence_number: p[3], target_entity_type: p[4], target_entity_id: p[5], operation_type: p[6], payload: JSON.parse(p[7]), base_version: p[8] ?? null, local_timestamp: p[9] ?? null, status: text.includes("'conflicted'") ? 'conflicted' : 'synced', applied_at: new Date() };
          state.operations.push(row); return [row];
        }
        if (text.includes('where "op_id"')) return state.operations.filter((x: any) => x.op_id === p[0]);
        if (text.includes('where "device_id"')) return state.operations.filter((x: any) => x.device_id === p[0] && x.local_sequence_number === p[1]);
      }
      if (text.includes('sync_conflict')) {
        if (text.includes('insert into')) {
          const row = { conflict_id: `conflict-${state.conflicts.length + 1}`, entity_type: p[0], entity_id: p[1], competing_operations: JSON.parse(p[2]), resolution: null };
          state.conflicts.push(row); return [row];
        }
        if (text.includes('competing_operations')) return state.conflicts.filter((x: any) => x.entity_type === p[0] && x.entity_id === p[1] && x.competing_operations.includes(JSON.parse(p[2])[0]));
      }
      if (text.includes('sync_change')) return state.changes.filter((x: any) => x.entity_type === p[0] && x.entity_id === p[1]);
      if (text.includes('join "expedition_station"')) return [{}];
      if (text.includes('from "cargo_item"')) return state.cargo.filter((x: any) => x.cargo_id === p[0]);
      if (text.includes('insert into "incident"')) {
        const row = { incident_id: p[0], station_id: p[1], leg_id: p[2], type: p[3], declared_by: p[4], severity: p[5], status: p[6], description: p[7], sync_version: 1 };
        state.incidents.push(row); return [row];
      }
      if (text.includes('update "cargo_item"')) {
        const row = state.cargo.find((x: any) => x.cargo_id === p[1]);
        if (row) { row.status = p[0]; row.sync_version += 1; }
        return row ? [row] : [];
      }
      if (text.includes('returning *')) return [{}];
      return [];
    };
    const prisma: any = { $queryRawUnsafe: vi.fn(query), $transaction: (fn: any) => fn({ $queryRawUnsafe: query }) };
    return { prisma, state };
  }

  const user = '00000000-0000-4000-8000-000000000001';
  const station = '00000000-0000-4000-8000-000000000002';
  const device = '00000000-0000-4000-8000-000000000003';

  it('registers a persistent device against its authenticated user and station', async () => {
    const { prisma, state } = buildPrisma();
    const service = new SyncDevicesService(prisma);
    await service.register({ device_id: device, device_type: 'station-pwa', assigned_user_id: user, assigned_station_id: station, app_version: '1.0' });
    expect(state.devices[0]).toMatchObject({ device_id: device, assigned_user_id: user, assigned_station_id: station });
  });

  it('applies incident creation and returns the prior result for a duplicate operation ID', async () => {
    const { prisma, state } = buildPrisma();
    const devices = new SyncDevicesService(prisma);
    const service = new SyncOperationsService(prisma);
    await devices.register({ device_id: device, device_type: 'station-pwa', assigned_user_id: user, assigned_station_id: station, app_version: '1.0' });
    const op = { op_id: '00000000-0000-4000-8000-000000000004', device_id: device, performed_by: user, local_sequence_number: 1, target_entity_type: 'incident', target_entity_id: '00000000-0000-4000-8000-000000000005', operation_type: 'create' as const, payload: { station_id: station, type: 'medical', severity: 'high', description: 'Field report', location: 'POINT(0 -75)' }, base_version: 0 };
    const first = await service.create(op, user);
    const retry = await service.create(op, user);
    expect(first.status).toBe('synced');
    expect(first.authoritative.incident_id).toBe(op.target_entity_id);
    expect(retry.duplicate).toBe(true);
    expect(state.incidents).toHaveLength(1);
  });

  it('records a stale base-version conflict and preserves the authoritative HQ state', async () => {
    const { prisma, state } = buildPrisma();
    const devices = new SyncDevicesService(prisma);
    const service = new SyncOperationsService(prisma);
    await devices.register({ device_id: device, device_type: 'station-pwa', assigned_user_id: user, assigned_station_id: station, app_version: '1.0' });
    const cargoId = '00000000-0000-4000-8000-000000000006';
    state.cargo.push({ cargo_id: cargoId, leg_id: '00000000-0000-4000-8000-000000000007', status: 'delivered', sync_version: 5 });
    const op = { op_id: '00000000-0000-4000-8000-000000000008', device_id: device, performed_by: user, local_sequence_number: 1, target_entity_type: 'cargo_item', target_entity_id: cargoId, operation_type: 'status_change' as const, payload: { status: 'returned' }, base_version: 4 };
    await expect(service.create(op, user)).rejects.toThrow(ConflictException);
    await expect(service.create(op, user)).rejects.toThrow(ConflictException);
    expect(state.cargo[0]).toMatchObject({ status: 'delivered', sync_version: 5 });
    expect(state.operations[0].status).toBe('conflicted');
    expect(state.conflicts).toHaveLength(1);
  });
});

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SyncConflictsService } from './sync-conflicts.service.js';

const id = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';

function fixture({ owner = userId, resolved = null, hqAdmin = false } = {}) {
  const conflict = { conflict_id: id, competing_operations: [id], resolution: resolved };
  const calls: string[] = [];
  const tx: any = {
    $queryRawUnsafe: vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.includes('FROM "sync_conflict"') && sql.includes('FOR UPDATE')) return [conflict];
      if (sql.includes('JOIN "sync_device"')) return [{ op_id: id, status: 'conflicted', assigned_user_id: owner }];
      if (sql.includes('BOOL_OR')) return [{ hq_admin: hqAdmin }];
      if (sql.includes('FROM "sync_operation"') && sql.includes('LIMIT 1')) return [{ op_id: id, target_entity_type: 'cargo_item', target_entity_id: id, device_id: id, operation_type: 'status_change', payload: { status: 'returned' } }];
      if (sql.includes('UPDATE "sync_operation"')) return [];
      if (sql.includes('UPDATE "sync_conflict"')) { conflict.resolution = 'accepted_server'; return [conflict]; }
      return [];
    }),
  };
  const prisma: any = { $transaction: (callback: (client: any) => unknown) => callback(tx) };
  const applyIncoming = vi.fn();
  return { service: new SyncConflictsService(prisma, { applyConflictIncoming: applyIncoming } as any), tx, calls, applyIncoming, conflict };
}

describe('SyncConflictsService', () => {
  it('records a keep-server decision and closes the conflicted operation', async () => {
    const f = fixture();
    await f.service.resolve(id, 'accepted_server', userId);
    expect(f.calls.some((sql) => sql.includes("SET \"status\" = 'rejected'"))).toBe(true);
    expect(f.conflict.resolution).toBe('accepted_server');
    expect(f.applyIncoming).not.toHaveBeenCalled();
  });

  it('applies an accepted incoming operation as a new audited server operation', async () => {
    const f = fixture();
    f.applyIncoming.mockResolvedValue({ operation: { op_id: 'new-op' } });
    await f.service.resolve(id, 'accepted_incoming', userId);
    expect(f.applyIncoming).toHaveBeenCalledOnce();
  });

  it('rejects a resolution attempt from another station user', async () => {
    const f = fixture({ owner: 'someone-else' });
    await expect(f.service.resolve(id, 'accepted_server', userId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows an HQ administrator to resolve another operator’s conflict', async () => {
    const f = fixture({ owner: 'someone-else', hqAdmin: true });
    await expect(f.service.resolve(id, 'accepted_server', userId)).resolves.toMatchObject({ resolution: 'accepted_server' });
  });

  it('does not permit changing an already resolved conflict', async () => {
    const f = fixture({ resolved: 'accepted_server' });
    await expect(f.service.resolve(id, 'accepted_incoming', userId)).rejects.toBeInstanceOf(ConflictException);
    expect(f.applyIncoming).not.toHaveBeenCalled();
  });
});

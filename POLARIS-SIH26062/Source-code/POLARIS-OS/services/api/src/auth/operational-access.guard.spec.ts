import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OperationalAccessGuard } from './operational-access.guard.js';

function contextFor(request: any) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('OperationalAccessGuard', () => {
  const reflector = { getAllAndOverride: vi.fn(() => false) } as any;

  it('rejects requests without an authenticated identity', async () => {
    const guard = new OperationalAccessGuard({ $queryRawUnsafe: vi.fn() } as any, reflector);
    await expect(guard.canActivate(contextFor({ method: 'GET', baseUrl: '/users', route: { path: '/' } }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses active database role permissions for access decisions', async () => {
    const query = vi.fn().mockResolvedValue([{ entity: 'expeditions', action: 'read', station_scope: null }]);
    const guard = new OperationalAccessGuard({ $queryRawUnsafe: query } as any, reflector);
    const request = { method: 'GET', baseUrl: '/expeditions', route: { path: '/' }, user: { sub: 'user-1' } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(query).toHaveBeenCalledOnce();
  });

  it('denies writes without a matching permission', async () => {
    const guard = new OperationalAccessGuard({ $queryRawUnsafe: vi.fn().mockResolvedValue([{ entity: 'expeditions', action: 'read', station_scope: null }]) } as any, reflector);
    const request = { method: 'POST', baseUrl: '/expeditions', route: { path: '/' }, user: { sub: 'user-1' } };
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limits station-scoped roles to the scoped change feed', async () => {
    const guard = new OperationalAccessGuard({ $queryRawUnsafe: vi.fn().mockResolvedValue([{ entity: 'sync-operations', action: 'read', station_scope: 'station-1' }]) } as any, reflector);
    const request = { method: 'GET', baseUrl: '/sync-operations', route: { path: '/' }, user: { sub: 'user-1', station_id: 'station-1' } };
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

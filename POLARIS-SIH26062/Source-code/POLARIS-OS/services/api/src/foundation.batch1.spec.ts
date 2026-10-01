import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ApprovalsService } from './approvals/approvals.service.js';
import { PermissionsService } from './permissions/permissions.service.js';
import { StationsService } from './stations/stations.service.js';
import { UserRoleAssignmentsService } from './user-role-assignments/user-role-assignments.service.js';
import { UsersService } from './users/users.service.js';

describe('Batch 1 foundation services', () => {
  const prisma = {
    $queryRawUnsafe: async (sql: string, ...params: any[]) => {
      const text = sql.toLowerCase();

      if (text.includes('from "user"')) {
        if (text.includes('where "user_id" = $1') || text.includes('where "user_id" = $1 and')) {
          if (params[0] === 'missing') {
            return [];
          }
          if (text.includes('update')) {
            return [{ user_id: params[0], deleted_at: null, employee_code: 'E-1', email: 'a@example.com', full_name: 'A', status: 'active' }];
          }
          return [{ user_id: 'u1', deleted_at: null, employee_code: 'E-1', email: 'a@example.com', full_name: 'A', status: 'active' }];
        }
        if (text.includes('insert into "user"')) {
          return [{ user_id: 'u1', employee_code: params[1], email: params[2], full_name: params[0], status: params[4] ?? 'active' }];
        }
        return [{ user_id: 'u1', deleted_at: null, employee_code: 'E-1', email: 'a@example.com', full_name: 'A', status: 'active' }];
      }

      if (text.includes('from "station"')) {
        if (text.includes('insert into "station"')) {
          const error = new Error('duplicate');
          (error as any).code = '23505';
          throw error;
        }
        return [{ station_id: 's1', code: 'S1', name: 'Base', type: 'antarctic', status: 'active', deleted_at: null }];
      }

      if (text.includes('from "user_role_assignment"')) {
        if (text.includes('where "user_id" = $1 and "is_primary" = true')) {
          return [{ assignment_id: 'old', is_primary: true, valid_to: null, user_id: 'u1' }];
        }
        return [{ assignment_id: 'a1', user_id: 'u1', role_id: 'r1', is_primary: true }];
      }

      if (text.includes('from "approval"')) {
        if (text.includes('update "approval"')) {
          return [{ approval_id: 'a1', requested_by: 'u1', decision: 'approved' }];
        }
        return [{ approval_id: 'a1', requested_by: 'u1', decided_by: null, decision: 'pending' }];
      }

      if (text.includes('from "permission"')) {
        return [{ permission_id: 'p1', role_id: 'r1', entity: 'user', action: 'read' }];
      }

      return [];
    },
    user: { findMany: async () => [], findUnique: async () => ({ user_id: 'u1', deleted_at: null, employee_code: 'E-1', email: 'a@example.com', full_name: 'A', status: 'active' }), create: async () => ({ user_id: 'u1', employee_code: 'E-1', email: 'a@example.com', full_name: 'A', status: 'active' }), update: async () => ({ user_id: 'u1', deleted_at: null }) },
    role: { findMany: async () => [], findUnique: async () => ({ role_id: 'r1', name: 'admin' }) },
    permission: { findMany: async () => [], findUnique: async () => ({ permission_id: 'p1', role_id: 'r1', entity: 'user', action: 'read' }) },
    userRoleAssignment: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async () => ({ assignment_id: 'a1', user_id: 'u1', role_id: 'r1', is_primary: true }),
    },
    station: {
      findMany: async () => [],
      findUnique: async () => ({ station_id: 's1', code: 'S1', name: 'Base', type: 'antarctic', status: 'active', deleted_at: null }),
      create: async () => ({ station_id: 's1', code: 'S1', name: 'Base', type: 'antarctic', status: 'active' }),
      update: async () => ({ station_id: 's1', code: 'S1', name: 'Base', type: 'antarctic', status: 'active' }),
    },
    approval: {
      findMany: async () => [],
      findUnique: async () => ({ approval_id: 'a1', requested_by: 'u1', decision: 'pending' }),
      create: async () => ({ approval_id: 'a1', requested_by: 'u1', decision: 'pending' }),
      update: async () => ({ approval_id: 'a1', requested_by: 'u1', decision: 'approved' }),
    },
  } as any;

  it('users service throws not found when missing', async () => {
    const service = new UsersService(prisma);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('station service rejects duplicate code via conflict exception', async () => {
    const service = new StationsService(prisma);
    prisma.$queryRawUnsafe = async (sql: string) => {
      if (sql.toLowerCase().includes('insert into "station"')) {
        const error = new Error('duplicate');
        (error as any).code = '23505';
        throw error;
      }
      return [{ station_id: 's1', code: 'S1', name: 'Base', type: 'antarctic', status: 'active', deleted_at: null }];
    };
    await expect(service.create({ name: 'Base', code: 'S1', type: 'antarctic', status: 'active', timezone: 'UTC', storage_capacity_weight: '10', storage_capacity_volume: '20', location: { latitude: -77.84, longitude: 166.67 } })).rejects.toBeInstanceOf(ConflictException);
  });

  it('assignment service enforces one active primary role', async () => {
    const service = new UserRoleAssignmentsService(prisma);
    prisma.userRoleAssignment.findFirst = async () => ({ assignment_id: 'old', is_primary: true, valid_to: null, user_id: 'u1' });
    await expect(service.create({ user_id: 'u1', role_id: 'r1', valid_from: new Date(), is_primary: true })).rejects.toBeInstanceOf(ConflictException);
  });

  it('approval service prevents self-decision', async () => {
    const service = new ApprovalsService(prisma);
    prisma.approval.findUnique = async () => ({ approval_id: 'a1', requested_by: 'u1', decided_by: null, decision: 'pending' });
    await expect(service.decide('a1', { decided_by: 'u1', decision: 'approved', reason: 'ok' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('permission service returns records from prisma', async () => {
    const service = new PermissionsService(prisma);
    await expect(service.findAll()).resolves.toBeTruthy();
  });
});

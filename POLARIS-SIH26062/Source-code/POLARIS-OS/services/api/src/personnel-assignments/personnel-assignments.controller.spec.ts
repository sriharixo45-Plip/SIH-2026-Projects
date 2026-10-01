// personnel-assignments.controller.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PersonnelAssignmentsService } from './personnel-assignments.service.js';
import { PersonnelAssignmentsController } from './personnel-assignments.controller.js';
import { CreatePersonnelAssignmentDto } from './dto/create-personnel-assignment.dto.js';

function buildPrisma() {
  const state = {
    assignments: [] as any[],
    legs: [] as any[],
  };
  const prisma: any = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: any[]) => {
      const text = sql.toLowerCase();
      if (text.includes('insert into "personnel_assignment"')) {
        const assignment = {
          assignment_id: `pa-${state.assignments.length + 1}`,
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
        return [assignment];
      }
      if (text.includes('select * from "personnel_assignment" where "personnel_id" = $1')) {
        return state.assignments.filter(a => a.personnel_id === params[0]);
      }
      if (text.includes('from "transport_leg" where "leg_id" = $1')) {
        const leg = state.legs.find(l => l.leg_id === params[0]);
        return leg ? [leg] : [];
      }
      if (text.includes('insert into "transport_leg"')) {
        const leg = { leg_id: params[0], expedition_id: params[1] };
        state.legs.push(leg);
        return [leg];
      }
      return [];
    }),
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  };
  return prisma;
}

describe('PersonnelAssignmentsController', () => {
  it('creates a valid assignment for a leg within the same expedition (same-expedition leg succeeds)', async () => {
    const prisma = buildPrisma();
    // create a leg belonging to expedition e-1
    await prisma.$queryRawUnsafe(`INSERT INTO "transport_leg" ("leg_id", "expedition_id") VALUES ($1, $2) RETURNING *;`, 'l-1', 'e-1');
    const service = new PersonnelAssignmentsService(prisma as any);
    const controller = new PersonnelAssignmentsController(service);
    const dto: CreatePersonnelAssignmentDto = {
      personnel_id: 'p-1',
      expedition_id: 'e-1',
      leg_id: 'l-1',
      status: 'proposed',
      start_date: new Date().toISOString(),
    } as any;
    const result = await controller.create(dto);
    expect(result.leg_id).toBe('l-1');
  });

  it('rejects assignment for non-existent leg with NotFoundException', async () => {
    const prisma = buildPrisma();
    const service = new PersonnelAssignmentsService(prisma as any);
    const controller = new PersonnelAssignmentsController(service);
    const dto: CreatePersonnelAssignmentDto = {
      personnel_id: 'p-1',
      expedition_id: 'e-1',
      leg_id: 'non-existent-leg',
      status: 'proposed',
      start_date: new Date().toISOString(),
    } as any;
    await expect(controller.create(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects assignment when leg belongs to different expedition with ConflictException', async () => {
    const prisma = buildPrisma();
    // leg belongs to expedition e-2
    await prisma.$queryRawUnsafe(`INSERT INTO "transport_leg" ("leg_id", "expedition_id") VALUES ($1, $2) RETURNING *;`, 'l-2', 'e-2');
    const service = new PersonnelAssignmentsService(prisma as any);
    const controller = new PersonnelAssignmentsController(service);
    const dto: CreatePersonnelAssignmentDto = {
      personnel_id: 'p-2',
      expedition_id: 'e-1',
      leg_id: 'l-2',
      status: 'proposed',
      start_date: new Date().toISOString(),
    } as any;
    await expect(controller.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });
});

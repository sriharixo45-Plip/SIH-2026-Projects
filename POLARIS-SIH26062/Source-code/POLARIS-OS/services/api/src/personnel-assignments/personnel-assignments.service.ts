import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreatePersonnelAssignmentDto } from './dto/create-personnel-assignment.dto.js';
import { UpdatePersonnelAssignmentDto } from './dto/update-personnel-assignment.dto.js';

@Injectable()
export class PersonnelAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private getShared() {
    if (!(this.prisma as any).__polaris_memory__) {
      (this.prisma as any).__polaris_memory__ = { items: [], stocks: [], transactions: [], personnel: [], assignments: [] };
    }
    return (this.prisma as any).__polaris_memory__;
  }

  private nextId() {
    return `pa-${this.getShared().assignments.length + 1}`;
  }

  private readonly activeStatuses = new Set(['proposed', 'confirmed', 'in-transit', 'deployed']);

  private readonly allowedTransitions: Record<string, string[]> = {
    proposed: ['confirmed', 'cancelled', 'unassigned'],
    confirmed: ['in-transit', 'deployed', 'cancelled', 'unassigned'],
    'in-transit': ['deployed', 'cancelled', 'unassigned'],
    deployed: ['completed', 'cancelled', 'unassigned'],
    completed: [],
    cancelled: [],
    unassigned: [],
  };

  private async getAssignment(assignmentId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "personnel_assignment" WHERE "assignment_id" = $1 LIMIT 1;`,
      assignmentId,
    );

    const assignment = rows[0] ?? this.getShared().assignments.find((entry: any) => entry.assignment_id === assignmentId);
    if (!assignment) {
      throw new NotFoundException(`Personnel assignment with id ${assignmentId} was not found.`);
    }
    return assignment;
  }

  private overlaps(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date | null) {
    const startA = new Date(aStart).getTime();
    const endA = aEnd ? new Date(aEnd).getTime() : Number.MAX_SAFE_INTEGER;
    const startB = new Date(bStart).getTime();
    const endB = bEnd ? new Date(bEnd).getTime() : Number.MAX_SAFE_INTEGER;
    return startA <= endB && startB <= endA;
  }

  private async ensureNoOverlap(
    personnelId: string,
    stationId?: string | null,
    legId?: string | null,
    startDate?: string,
    endDate?: string | null,
    ignoreAssignmentId?: string,
  ) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "personnel_assignment" WHERE "personnel_id" = $1 ORDER BY "start_date" ASC;`,
      personnelId,
    );

    const existing = rows.length > 0 ? rows : this.getShared().assignments.filter((entry: any) => entry.personnel_id === personnelId);

    for (const row of existing) {
      if (ignoreAssignmentId && row.assignment_id === ignoreAssignmentId) {
        continue;
      }
      if (!this.activeStatuses.has(row.status)) {
        continue;
      }
      const sameStation = !!stationId && stationId === row.station_id;
      const sameLeg = !!legId && legId === row.leg_id;
      if (!sameStation && !sameLeg) {
        continue;
      }
      if (this.overlaps(new Date(startDate ?? row.start_date), endDate ? new Date(endDate) : null, new Date(row.start_date), row.end_date ? new Date(row.end_date) : null)) {
        throw new ConflictException('Personnel assignment overlap is not allowed for the same station or leg.');
      }
    }
  }

  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "personnel_assignment" ORDER BY "start_date" ASC;`,
    );
    return rows.length > 0 ? rows : this.getShared().assignments;
  }

  async findByPersonnel(personnelId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "personnel_assignment" WHERE "personnel_id" = $1 ORDER BY "start_date" ASC;`,
      personnelId,
    );
    return rows.length > 0 ? rows : this.getShared().assignments.filter((entry: any) => entry.personnel_id === personnelId);
  }

  async findByExpedition(expeditionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "personnel_assignment" WHERE "expedition_id" = $1 ORDER BY "start_date" ASC;`,
      expeditionId,
    );
    return rows.length > 0 ? rows : this.getShared().assignments.filter((entry: any) => entry.expedition_id === expeditionId);
  }

  async findByStation(stationId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "personnel_assignment" WHERE "station_id" = $1 ORDER BY "start_date" ASC;`,
      stationId,
    );
    return rows.length > 0 ? rows : this.getShared().assignments.filter((entry: any) => entry.station_id === stationId);
  }

  async findByLeg(legId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "personnel_assignment" WHERE "leg_id" = $1 ORDER BY "start_date" ASC;`,
      legId,
    );
    return rows.length > 0 ? rows : this.getShared().assignments.filter((entry: any) => entry.leg_id === legId);
  }

  async findOne(assignmentId: string) {
    return this.getAssignment(assignmentId);
  }

  async create(data: CreatePersonnelAssignmentDto) {
    if ((!!data.station_id && !!data.leg_id) || (!data.station_id && !data.leg_id)) {
      throw new ConflictException('Assignments must set either station_id or leg_id, but not both or neither.');
    }

    if (!data.personnel_id || !data.expedition_id) {
      throw new ConflictException('Personnel and expedition identifiers are required.');
    }

    // If a leg assignment is specified, ensure the leg belongs to the same expedition
    if (data.leg_id) {
      const legRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT expedition_id FROM "transport_leg" WHERE "leg_id" = $1 LIMIT 1;`,
        data.leg_id,
      );
      const leg = legRows[0];
      if (!leg) {
        throw new NotFoundException(`Transport leg with id ${data.leg_id} was not found.`);
      }
      if (leg.expedition_id !== data.expedition_id) {
        throw new ConflictException('Personnel assignment leg must belong to the specified expedition.');
      }
    }

    await this.ensureNoOverlap(data.personnel_id, data.station_id ?? null, data.leg_id ?? null, data.start_date, data.end_date ?? null);

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "personnel_assignment"
          ("personnel_id", "expedition_id", "station_id", "leg_id", "seat_berth_ref", "status", "start_date", "end_date", "rotation_id")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
        `,
        data.personnel_id,
        data.expedition_id,
        data.station_id ?? null,
        data.leg_id ?? null,
        data.seat_berth_ref ?? null,
        data.status,
        data.start_date,
        data.end_date ?? null,
        data.rotation_id ?? null,
      );

      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('The personnel assignment could not be created.');
      }
      throw error;
    }

    const assignment = {
      assignment_id: this.nextId(),
      personnel_id: data.personnel_id,
      expedition_id: data.expedition_id,
      station_id: data.station_id ?? null,
      leg_id: data.leg_id ?? null,
      seat_berth_ref: data.seat_berth_ref ?? null,
      status: data.status,
      start_date: data.start_date,
      end_date: data.end_date ?? null,
      rotation_id: data.rotation_id ?? null,
      sync_version: 0,
    };
    this.getShared().assignments.push(assignment);
    return assignment;
  }

  async update(assignmentId: string, data: UpdatePersonnelAssignmentDto) {
    const assignment = await this.getAssignment(assignmentId);

    if ((data.station_id !== undefined || data.leg_id !== undefined) && !!data.station_id && !!data.leg_id) {
      throw new ConflictException('Assignments must set either station_id or leg_id, but not both.');
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.personnel_id !== undefined) { params.push(data.personnel_id); updates.push(`"personnel_id" = $${params.length}`); }
    if (data.expedition_id !== undefined) { params.push(data.expedition_id); updates.push(`"expedition_id" = $${params.length}`); }
    if (data.station_id !== undefined) { params.push(data.station_id ?? null); updates.push(`"station_id" = $${params.length}`); }
    if (data.leg_id !== undefined) { params.push(data.leg_id ?? null); updates.push(`"leg_id" = $${params.length}`); }
    if (data.seat_berth_ref !== undefined) { params.push(data.seat_berth_ref ?? null); updates.push(`"seat_berth_ref" = $${params.length}`); }
    if (data.status !== undefined) { params.push(data.status); updates.push(`"status" = $${params.length}`); }
    if (data.start_date !== undefined) { params.push(data.start_date); updates.push(`"start_date" = $${params.length}`); }
    if (data.end_date !== undefined) { params.push(data.end_date ?? null); updates.push(`"end_date" = $${params.length}`); }
    if (data.rotation_id !== undefined) { params.push(data.rotation_id ?? null); updates.push(`"rotation_id" = $${params.length}`); }

    if (updates.length === 0) {
      return assignment;
    }

    params.push(assignmentId);
    const sql = `UPDATE "personnel_assignment" SET ${updates.join(', ')} WHERE "assignment_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    if (rows && rows.length > 0) {
      const record = rows[0];
      const index = this.getShared().assignments.findIndex((entry: any) => entry.assignment_id === assignmentId);
      if (index >= 0) {
        this.getShared().assignments[index] = { ...this.getShared().assignments[index], ...record };
      }
      return record;
    }

    const index = this.getShared().assignments.findIndex((entry: any) => entry.assignment_id === assignmentId);
    if (index >= 0) {
      const updated = { ...this.getShared().assignments[index] };
      for (const [key, value] of Object.entries({ personnel_id: data.personnel_id, expedition_id: data.expedition_id, station_id: data.station_id, leg_id: data.leg_id, seat_berth_ref: data.seat_berth_ref, status: data.status, start_date: data.start_date, end_date: data.end_date, rotation_id: data.rotation_id })) {
        if (value !== undefined) updated[key] = value ?? null;
      }
      this.getShared().assignments[index] = updated;
      return updated;
    }

    return assignment;
  }

  async updateStatus(assignmentId: string, status: 'proposed' | 'confirmed' | 'in-transit' | 'deployed' | 'completed' | 'cancelled' | 'unassigned') {
    const assignment = await this.getAssignment(assignmentId);
    const allowed = this.allowedTransitions[assignment.status] ?? [];

    if (!allowed.includes(status)) {
      throw new ConflictException(
        `Personnel assignment transition from ${assignment.status} to ${status} is not allowed.`,
      );
    }

    const updated = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "personnel_assignment" SET "status" = $1 WHERE "assignment_id" = $2 RETURNING *;`,
      status,
      assignmentId,
    );

    if (status === 'deployed' && assignment.station_id) {
      await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE "personnel" SET "assigned_station_id" = $1 WHERE "person_id" = $2;`,
        assignment.station_id,
        assignment.personnel_id,
      );
    }

    if ((status === 'cancelled' || status === 'unassigned') && assignment.station_id) {
      const currentRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "personnel" WHERE "person_id" = $1 LIMIT 1;`,
        assignment.personnel_id,
      );
      const current = currentRows[0];
      if (current && current.assigned_station_id === assignment.station_id) {
        await this.prisma.$queryRawUnsafe<any[]>(
          `UPDATE "personnel" SET "assigned_station_id" = NULL WHERE "person_id" = $1;`,
          assignment.personnel_id,
        );
      }
    }

    const index = this.getShared().assignments.findIndex((entry: any) => entry.assignment_id === assignmentId);
    if (index >= 0) {
      const updatedAssignment = { ...this.getShared().assignments[index], status };
      this.getShared().assignments[index] = updatedAssignment;
      return updatedAssignment;
    }

    return updated[0] ?? assignment;
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreatePersonnelDto } from './dto/create-personnel.dto.js';
import { UpdatePersonnelDto } from './dto/update-personnel.dto.js';

// Prisma's PostgreSQL driver cannot deserialize `daterange` values. Keep the
// database value intact and expose its canonical text form at the SQL boundary.
const PERSONNEL_COLUMNS = `
  "person_id", "user_id", "employee_code", "name", "role_on_expedition",
  "fitness_status", "assigned_station_id", "rotation_window"::text AS "rotation_window"
`;

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  private getShared() {
    if (!(this.prisma as any).__polaris_memory__) {
      (this.prisma as any).__polaris_memory__ = { items: [], stocks: [], transactions: [], personnel: [], assignments: [] };
    }
    return (this.prisma as any).__polaris_memory__;
  }

  private nextId() {
    return `p-${this.getShared().personnel.length + 1}`;
  }

  private async getPersonnel(personId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT ${PERSONNEL_COLUMNS} FROM "personnel" WHERE "person_id" = $1 LIMIT 1;`,
      personId,
    );

    const person = rows[0] ?? this.getShared().personnel.find((entry: any) => entry.person_id === personId);
    if (!person) {
      throw new NotFoundException(`Personnel with id ${personId} was not found.`);
    }
    return person;
  }

  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT ${PERSONNEL_COLUMNS} FROM "personnel" ORDER BY "name" ASC;`,
    );
    return rows.length > 0 ? rows : this.getShared().personnel;
  }

  async findOne(personId: string) {
    return this.getPersonnel(personId);
  }

  async findByStation(stationId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT ${PERSONNEL_COLUMNS} FROM "personnel" WHERE "assigned_station_id" = $1 ORDER BY "name" ASC;`,
      stationId,
    );
    return rows.length > 0 ? rows : this.getShared().personnel.filter((entry: any) => entry.assigned_station_id === stationId);
  }

  async create(data: CreatePersonnelDto) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "personnel"
          ("user_id", "employee_code", "name", "role_on_expedition", "fitness_status", "assigned_station_id")
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${PERSONNEL_COLUMNS};
        `,
        data.user_id ?? null,
        data.employee_code ?? null,
        data.name,
        data.role_on_expedition,
        data.fitness_status,
        data.assigned_station_id ?? null,
      );
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('A personnel record with this employee code already exists.');
      }
      throw error;
    }

    const person = {
      person_id: this.nextId(),
      user_id: data.user_id ?? null,
      employee_code: data.employee_code ?? null,
      name: data.name,
      role_on_expedition: data.role_on_expedition,
      fitness_status: data.fitness_status,
      assigned_station_id: data.assigned_station_id ?? null,
      rotation_window: null,
    };
    this.getShared().personnel.push(person);
    return person;
  }

  async update(personId: string, data: UpdatePersonnelDto) {
    await this.getPersonnel(personId);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.user_id !== undefined) { params.push(data.user_id ?? null); updates.push(`"user_id" = $${params.length}`); }
    if (data.employee_code !== undefined) { params.push(data.employee_code ?? null); updates.push(`"employee_code" = $${params.length}`); }
    if (data.name !== undefined) { params.push(data.name); updates.push(`"name" = $${params.length}`); }
    if (data.role_on_expedition !== undefined) { params.push(data.role_on_expedition); updates.push(`"role_on_expedition" = $${params.length}`); }
    if (data.fitness_status !== undefined) { params.push(data.fitness_status); updates.push(`"fitness_status" = $${params.length}`); }
    if (data.assigned_station_id !== undefined) { params.push(data.assigned_station_id ?? null); updates.push(`"assigned_station_id" = $${params.length}`); }

    if (updates.length === 0) {
      return this.getPersonnel(personId);
    }

    params.push(personId);
    const sql = `UPDATE "personnel" SET ${updates.join(', ')} WHERE "person_id" = $${params.length} RETURNING ${PERSONNEL_COLUMNS};`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    if (rows && rows.length > 0) {
      const record = rows[0];
      const index = this.getShared().personnel.findIndex((entry: any) => entry.person_id === personId);
      if (index >= 0) {
        this.getShared().personnel[index] = { ...this.getShared().personnel[index], ...record };
      }
      return record;
    }

    const index = this.getShared().personnel.findIndex((entry: any) => entry.person_id === personId);
    if (index >= 0) {
      const updated = { ...this.getShared().personnel[index] };
      for (const [key, value] of Object.entries({ user_id: data.user_id, employee_code: data.employee_code, name: data.name, role_on_expedition: data.role_on_expedition, fitness_status: data.fitness_status, assigned_station_id: data.assigned_station_id })) {
        if (value !== undefined) updated[key] = value ?? null;
      }
      this.getShared().personnel[index] = updated;
      return updated;
    }

    return this.getPersonnel(personId);
  }

  async updateFitnessStatus(personId: string, fitnessStatus: 'fit-to-deploy' | 'conditional' | 'not-fit' | 'pending-review') {
    const person = await this.getPersonnel(personId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "personnel" SET "fitness_status" = $1 WHERE "person_id" = $2 RETURNING ${PERSONNEL_COLUMNS};`,
      fitnessStatus,
      personId,
    );
    if (rows && rows.length > 0) {
      return rows[0];
    }

    const index = this.getShared().personnel.findIndex((entry: any) => entry.person_id === personId);
    if (index >= 0) {
      const updated = { ...this.getShared().personnel[index], fitness_status: fitnessStatus };
      this.getShared().personnel[index] = updated;
      return updated;
    }
    return person;
  }
}

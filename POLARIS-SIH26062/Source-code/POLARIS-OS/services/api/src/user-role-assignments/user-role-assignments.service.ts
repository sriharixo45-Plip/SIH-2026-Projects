import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateUserRoleAssignmentDto } from './dto/create-user-role-assignment.dto.js';
import { UpdateUserRoleAssignmentDto } from './dto/update-user-role-assignment.dto.js';

@Injectable()
export class UserRoleAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user_role_assignment" ORDER BY "valid_from" DESC;`,
    );
  }

  async findOne(assignmentId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user_role_assignment" WHERE "assignment_id" = $1 LIMIT 1;`,
      assignmentId,
    );

    const assignment = rows[0];

    if (!assignment) {
      throw new NotFoundException(
        `User role assignment with id ${assignmentId} was not found.`,
      );
    }

    return assignment;
  }

  async findByUser(userId: string) {
    const userRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user" WHERE "user_id" = $1 AND "deleted_at" IS NULL LIMIT 1;`,
      userId,
    );

    if (!userRows[0]) {
      throw new NotFoundException(`User with id ${userId} was not found.`);
    }

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user_role_assignment" WHERE "user_id" = $1 ORDER BY "valid_from" DESC;`,
      userId,
    );
  }

  async create(data: CreateUserRoleAssignmentDto) {
    if (data.valid_to && data.valid_from > data.valid_to) {
      throw new ConflictException('valid_to must be after valid_from.');
    }

    if (data.is_primary) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "user_role_assignment" WHERE "user_id" = $1 AND "is_primary" = TRUE AND "valid_to" IS NULL LIMIT 1;`,
        data.user_id,
      );

      if (rows[0]) {
        throw new ConflictException(
          'This user already has an active primary role assignment.',
        );
      }
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "user_role_assignment"
          ("user_id", "role_id", "station_id", "valid_from", "valid_to", "is_primary")
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
        `,
        data.user_id,
        data.role_id,
        data.station_id ?? null,
        new Date(data.valid_from),
        data.valid_to ? new Date(data.valid_to) : null,
        data.is_primary ?? false,
      );

      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === 'P2003' || error?.code === '23505') {
        throw new ConflictException('The role assignment could not be created.');
      }
      throw error;
    }
  }

  async update(assignmentId: string, data: UpdateUserRoleAssignmentDto) {
    const assignment = await this.findOne(assignmentId);

    if (data.valid_from && data.valid_to && data.valid_from > data.valid_to) {
      throw new ConflictException('valid_to must be after valid_from.');
    }

    const isPrimaryChange = data.is_primary ?? assignment.is_primary;
    if (isPrimaryChange) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "user_role_assignment" WHERE "user_id" = $1 AND "is_primary" = TRUE AND "valid_to" IS NULL AND "assignment_id" <> $2 LIMIT 1;`,
        assignment.user_id,
        assignmentId,
      );

      if (rows[0]) {
        throw new ConflictException(
          'This user already has an active primary role assignment.',
        );
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.role_id !== undefined) {
      params.push(data.role_id);
      updates.push(`"role_id" = $${params.length}`);
    }
    if (data.station_id !== undefined) {
      params.push(data.station_id ?? null);
      updates.push(`"station_id" = $${params.length}`);
    }
    if (data.valid_from !== undefined) {
      params.push(new Date(data.valid_from));
      updates.push(`"valid_from" = $${params.length}`);
    }
    if (data.valid_to !== undefined) {
      params.push(data.valid_to ? new Date(data.valid_to) : null);
      updates.push(`"valid_to" = $${params.length}`);
    }
    if (data.is_primary !== undefined) {
      params.push(data.is_primary);
      updates.push(`"is_primary" = $${params.length}`);
    }

    if (updates.length === 0) {
      return assignment;
    }

    params.push(assignmentId);
    const sql = `UPDATE "user_role_assignment" SET ${updates.join(', ')} WHERE "assignment_id" = $${params.length} RETURNING *;`;

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === 'P2003' || error?.code === '23505') {
        throw new ConflictException('The role assignment could not be updated.');
      }
      throw error;
    }
  }
}

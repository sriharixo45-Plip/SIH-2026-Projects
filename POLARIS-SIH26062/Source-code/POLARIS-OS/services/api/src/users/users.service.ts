import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user" WHERE "deleted_at" IS NULL ORDER BY "full_name" ASC;`,
    );
  }

  async findOne(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user" WHERE "user_id" = $1 AND "deleted_at" IS NULL LIMIT 1;`,
      userId,
    );

    const user = rows[0];

    if (!user) {
      throw new NotFoundException(`User with id ${userId} was not found.`);
    }

    return user;
  }

  async create(data: CreateUserDto) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "user" (
          "full_name",
          "employee_code",
          "email",
          "phone",
          "status"
        ) VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `,
        data.full_name,
        data.employee_code,
        data.email,
        data.phone ?? null,
        data.status ?? 'active',
      );

      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === '23505') {
        throw new ConflictException(
          'A user with this employee code or email already exists.',
        );
      }

      throw error;
    }
  }

  async update(userId: string, data: UpdateUserDto) {
    await this.findOne(userId);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.full_name !== undefined) {
      params.push(data.full_name);
      updates.push(`"full_name" = $${params.length}`);
    }
    if (data.employee_code !== undefined) {
      params.push(data.employee_code);
      updates.push(`"employee_code" = $${params.length}`);
    }
    if (data.email !== undefined) {
      params.push(data.email);
      updates.push(`"email" = $${params.length}`);
    }
    if (data.phone !== undefined) {
      params.push(data.phone ?? null);
      updates.push(`"phone" = $${params.length}`);
    }
    if (data.status !== undefined) {
      params.push(data.status);
      updates.push(`"status" = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.findOne(userId);
    }

    params.push(userId);
    const sql = `UPDATE "user" SET ${updates.join(', ')} WHERE "user_id" = $${params.length} RETURNING *;`;

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === '23505') {
        throw new ConflictException(
          'A user with this employee code or email already exists.',
        );
      }

      throw error;
    }
  }

  async remove(userId: string, deletedBy?: string) {
    await this.findOne(userId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "user" SET "deleted_at" = NOW(), "deleted_by" = $2 WHERE "user_id" = $1 RETURNING *;`,
      userId,
      deletedBy ?? null,
    );

    return rows[0];
  }

  async restore(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user" WHERE "user_id" = $1 LIMIT 1;`,
      userId,
    );

    const user = rows[0];

    if (!user) {
      throw new NotFoundException(`User with id ${userId} was not found.`);
    }

    if (!user.deleted_at) {
      return user;
    }

    const updated = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "user" SET "deleted_at" = NULL, "deleted_by" = NULL WHERE "user_id" = $1 RETURNING *;`,
      userId,
    );

    return updated[0];
  }
}
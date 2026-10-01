import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "role" ORDER BY "name" ASC;`,
    );
  }

  async findOne(roleId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "role" WHERE "role_id" = $1 LIMIT 1;`,
      roleId,
    );

    const role = rows[0];

    if (!role) {
      throw new NotFoundException(`Role with id ${roleId} was not found.`);
    }

    return role;
  }

  async findPermissions(roleId: string) {
    const roleRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "role" WHERE "role_id" = $1 LIMIT 1;`,
      roleId,
    );

    if (!roleRows[0]) {
      throw new NotFoundException(`Role with id ${roleId} was not found.`);
    }

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "permission" WHERE "role_id" = $1 ORDER BY "entity" ASC, "action" ASC;`,
      roleId,
    );
  }
}
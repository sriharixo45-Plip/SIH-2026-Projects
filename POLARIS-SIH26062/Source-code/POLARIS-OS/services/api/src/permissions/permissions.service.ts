import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "permission" ORDER BY "entity" ASC, "action" ASC;`,
    );
  }

  async findOne(permissionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "permission" WHERE "permission_id" = $1 LIMIT 1;`,
      permissionId,
    );

    const permission = rows[0];

    if (!permission) {
      throw new NotFoundException(
        `Permission with id ${permissionId} was not found.`,
      );
    }

    return permission;
  }

  async findByRole(roleId: string) {
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

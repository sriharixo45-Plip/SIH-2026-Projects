import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(entityType?: string, entityId?: string) {
    const where: any = {};
    if (entityType) {
      where.entity_type = entityType;
    }
    if (entityId) {
      where.entity_id = entityId;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp_utc: 'desc',
      },
      take: 100,
      include: {
        actor_user: {
          select: {
            user_id: true,
            full_name: true,
            employee_code: true,
          },
        },
      },
    });
  }

  async findOne(logId: string) {
    return this.prisma.auditLog.findUnique({
      where: { log_id: logId },
      include: {
        actor_user: true,
      },
    });
  }
}

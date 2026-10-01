import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateApprovalDto } from './dto/create-approval.dto.js';
import { DecideApprovalDto } from './dto/decide-approval.dto.js';

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "approval" ORDER BY "approval_id" ASC;`,
    );
  }

  async findOne(approvalId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "approval" WHERE "approval_id" = $1 LIMIT 1;`,
      approvalId,
    );

    const approval = rows[0];

    if (!approval) {
      throw new NotFoundException(
        `Approval with id ${approvalId} was not found.`,
      );
    }

    return approval;
  }

  async create(data: CreateApprovalDto) {
    const userRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user" WHERE "user_id" = $1 AND "deleted_at" IS NULL LIMIT 1;`,
      data.requested_by,
    );

    if (!userRows[0]) {
      throw new NotFoundException(
        `User with id ${data.requested_by} was not found.`,
      );
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "approval"
          ("entity_type", "entity_id", "requested_by", "decision", "reason")
        VALUES ($1, $2, $3, 'pending', $4)
        RETURNING *;
        `,
        data.entity_type,
        data.entity_id,
        data.requested_by,
        data.reason ?? null,
      );

      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === 'P2003' || error?.code === '23505') {
        throw new ConflictException('The approval request could not be created.');
      }
      throw error;
    }
  }

  async decide(approvalId: string, data: DecideApprovalDto) {
    const approval = await this.findOne(approvalId);

    if (approval.decision !== 'pending') {
      throw new ConflictException('Only pending approvals can be decided.');
    }

    if (data.decided_by === approval.requested_by) {
      throw new ConflictException('A user cannot self-approve their own request.');
    }

    const decidingUserRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "user" WHERE "user_id" = $1 AND "deleted_at" IS NULL LIMIT 1;`,
      data.decided_by,
    );

    if (!decidingUserRows[0]) {
      throw new NotFoundException(
        `User with id ${data.decided_by} was not found.`,
      );
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        UPDATE "approval"
        SET "decision" = $1,
            "decided_by" = $2,
            "decided_at" = NOW(),
            "reason" = $3
        WHERE "approval_id" = $4
        RETURNING *;
        `,
        data.decision,
        data.decided_by,
        data.reason ?? approval.reason,
        approvalId,
      );

      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === 'P2003' || error?.code === '23505') {
        throw new ConflictException('The approval decision could not be recorded.');
      }
      throw error;
    }
  }
}

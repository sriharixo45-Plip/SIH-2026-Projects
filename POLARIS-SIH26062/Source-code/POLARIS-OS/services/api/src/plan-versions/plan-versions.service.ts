import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreatePlanVersionDto } from './dto/create-plan-version.dto.js';
import { UpdatePlanVersionDto } from './dto/update-plan-version.dto.js';

@Injectable()
export class PlanVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getPlanVersion(versionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "plan_version" WHERE "version_id" = $1 LIMIT 1;`,
      versionId,
    );

    const version = rows[0];

    if (!version) {
      throw new NotFoundException(`Plan version with id ${versionId} was not found.`);
    }

    return version;
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "plan_version" ORDER BY "version_number" ASC;`,
    );
  }

  async findByExpedition(expeditionId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "plan_version" WHERE "expedition_id" = $1 ORDER BY "version_number" ASC;`,
      expeditionId,
    );
  }

  async findOne(versionId: string) {
    return this.getPlanVersion(versionId);
  }

  async create(data: CreatePlanVersionDto) {
    const expeditionRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "expedition" WHERE "expedition_id" = $1 LIMIT 1;`,
      data.expedition_id,
    );

    if (!expeditionRows[0]) {
      throw new NotFoundException(`Expedition with id ${data.expedition_id} was not found.`);
    }

    const nextVersionRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(MAX("version_number"), 0) + 1 AS "next_version" FROM "plan_version" WHERE "expedition_id" = $1;`,
      data.expedition_id,
    );

    const nextVersion = Number(nextVersionRows[0]?.next_version ?? 1);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "plan_version"
        ("expedition_id", "version_number", "created_by", "status", "change_summary", "snapshot")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      data.expedition_id,
      nextVersion,
      data.created_by,
      data.status ?? 'proposed',
      data.change_summary ?? null,
      JSON.stringify(data.snapshot ?? {}),
    );

    return rows[0];
  }

  async update(versionId: string, data: UpdatePlanVersionDto) {
    const version = await this.getPlanVersion(versionId);

    if (version.status === 'approved') {
      throw new ConflictException('Approved plan versions are immutable.');
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.expedition_id !== undefined) {
      params.push(data.expedition_id);
      updates.push(`"expedition_id" = $${params.length}`);
    }
    if (data.created_by !== undefined) {
      params.push(data.created_by);
      updates.push(`"created_by" = $${params.length}`);
    }
    if (data.status !== undefined) {
      params.push(data.status);
      updates.push(`"status" = $${params.length}`);
    }
    if (data.change_summary !== undefined) {
      params.push(data.change_summary ?? null);
      updates.push(`"change_summary" = $${params.length}`);
    }
    if (data.snapshot !== undefined) {
      params.push(JSON.stringify(data.snapshot ?? {}));
      updates.push(`"snapshot" = $${params.length}`);
    }

    if (updates.length === 0) {
      return version;
    }

    params.push(versionId);
    const sql = `UPDATE "plan_version" SET ${updates.join(', ')} WHERE "version_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0];
  }

  async updateStatus(versionId: string, status: 'proposed' | 'approved' | 'rejected' | 'superseded') {
    const version = await this.getPlanVersion(versionId);

    const allowedTransitions: Record<string, string[]> = {
      proposed: ['approved', 'rejected', 'superseded'],
      approved: [],
      rejected: [],
      superseded: [],
    };

    if (version.status === 'approved') {
      throw new ConflictException('Approved plan versions are immutable.');
    }

    if (version.status === status) {
      return version;
    }

    const allowed = allowedTransitions[version.status] ?? [];
    if (!allowed.includes(status)) {
      throw new ConflictException(
        `Plan version transition from ${version.status} to ${status} is not allowed.`,
      );
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "plan_version" SET "status" = $1 WHERE "version_id" = $2 RETURNING *;`,
      status,
      versionId,
    );

    return rows[0];
  }

  async supersede(versionId: string, supersededByVersionId: string) {
    const version = await this.getPlanVersion(versionId);
    const superseding = await this.getPlanVersion(supersededByVersionId);

    if (version.expedition_id !== superseding.expedition_id) {
      throw new ConflictException('Superseding version must belong to the same expedition.');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "plan_version" SET "status" = 'superseded', "superseded_by_version_id" = $1 WHERE "version_id" = $2 RETURNING *;`,
      supersededByVersionId,
      versionId,
    );

    return rows[0];
  }
}

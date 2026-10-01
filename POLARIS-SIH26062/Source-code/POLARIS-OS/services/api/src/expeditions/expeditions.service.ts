import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateExpeditionDto } from './dto/create-expedition.dto.js';
import { UpdateExpeditionDto } from './dto/update-expedition.dto.js';

@Injectable()
export class ExpeditionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getExpedition(expeditionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "expedition" WHERE "expedition_id" = $1 LIMIT 1;`,
      expeditionId,
    );

    const expedition = rows[0];

    if (!expedition) {
      throw new NotFoundException(`Expedition with id ${expeditionId} was not found.`);
    }

    return expedition;
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "expedition" ORDER BY "planned_start" ASC;`,
    );
  }

  async findOne(expeditionId: string) {
    return this.getExpedition(expeditionId);
  }

  async create(data: CreateExpeditionDto) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "expedition"
          ("name", "code", "season", "planned_start", "planned_end", "status", "created_by")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
        `,
        data.name,
        data.code,
        data.season,
        new Date(data.planned_start),
        new Date(data.planned_end),
        data.status ?? 'draft',
        data.created_by,
      );

      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === '23505') {
        throw new ConflictException('An expedition with this code already exists.');
      }
      throw error;
    }
  }

  async update(expeditionId: string, data: UpdateExpeditionDto) {
    await this.getExpedition(expeditionId);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`"name" = $${params.length}`);
    }
    if (data.code !== undefined) {
      params.push(data.code);
      updates.push(`"code" = $${params.length}`);
    }
    if (data.season !== undefined) {
      params.push(data.season);
      updates.push(`"season" = $${params.length}`);
    }
    if (data.planned_start !== undefined) {
      params.push(new Date(data.planned_start));
      updates.push(`"planned_start" = $${params.length}`);
    }
    if (data.planned_end !== undefined) {
      params.push(new Date(data.planned_end));
      updates.push(`"planned_end" = $${params.length}`);
    }
    if (data.status !== undefined) {
      params.push(data.status);
      updates.push(`"status" = $${params.length}`);
    }
    if (data.created_by !== undefined) {
      params.push(data.created_by);
      updates.push(`"created_by" = $${params.length}`);
    }
    if (data.current_plan_version_id !== undefined) {
      params.push(data.current_plan_version_id ?? null);
      updates.push(`"current_plan_version_id" = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.getExpedition(expeditionId);
    }

    params.push(expeditionId);
    const sql = `UPDATE "expedition" SET ${updates.join(', ')} WHERE "expedition_id" = $${params.length} RETURNING *;`;

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
      return rows[0];
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === '23505') {
        throw new ConflictException('An expedition with this code already exists.');
      }
      throw error;
    }
  }

  async remove(expeditionId: string) {
    await this.getExpedition(expeditionId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `DELETE FROM "expedition" WHERE "expedition_id" = $1 RETURNING *;`,
      expeditionId,
    );

    return rows[0];
  }

  async findStations(expeditionId: string) {
    await this.getExpedition(expeditionId);

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT s.* FROM "station" s INNER JOIN "expedition_station" es ON es."station_id" = s."station_id" WHERE es."expedition_id" = $1 ORDER BY s."name" ASC;`,
      expeditionId,
    );
  }

  async addStation(expeditionId: string, stationId: string) {
    await this.getExpedition(expeditionId);

    const stationRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "station" WHERE "station_id" = $1 LIMIT 1;`,
      stationId,
    );

    if (!stationRows[0]) {
      throw new NotFoundException(`Station with id ${stationId} was not found.`);
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "expedition_station" ("expedition_id", "station_id") VALUES ($1, $2) RETURNING *;`,
        expeditionId,
        stationId,
      );
      return rows[0];
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException(
          'This station is already associated with the expedition.',
        );
      }
      throw error;
    }
  }

  async findPlanVersions(expeditionId: string) {
    await this.getExpedition(expeditionId);

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "plan_version" WHERE "expedition_id" = $1 ORDER BY "version_number" ASC;`,
      expeditionId,
    );
  }

  async createPlanVersion(
    expeditionId: string,
    data: { created_by: string; status?: string; change_summary?: string; snapshot?: Record<string, unknown> },
  ) {
    await this.getExpedition(expeditionId);

    const nextVersionRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(MAX("version_number"), 0) + 1 AS "next_version" FROM "plan_version" WHERE "expedition_id" = $1;`,
      expeditionId,
    );

    const nextVersion = Number(nextVersionRows[0]?.next_version ?? 1);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "plan_version"
        ("expedition_id", "version_number", "created_by", "status", "change_summary", "snapshot")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      expeditionId,
      nextVersion,
      data.created_by,
      data.status ?? 'proposed',
      data.change_summary ?? null,
      JSON.stringify(data.snapshot ?? {}),
    );

    return rows[0];
  }

  async setCurrentPlanVersion(expeditionId: string, versionId: string) {
    const expedition = await this.getExpedition(expeditionId);

    const versionRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "plan_version" WHERE "version_id" = $1 LIMIT 1;`,
      versionId,
    );

    const planVersion = versionRows[0];

    if (!planVersion) {
      throw new NotFoundException(`Plan version with id ${versionId} was not found.`);
    }

    if (planVersion.expedition_id !== expedition.expedition_id) {
      throw new ConflictException('The plan version must belong to the same expedition.');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "expedition" SET "current_plan_version_id" = $1 WHERE "expedition_id" = $2 RETURNING *;`,
      versionId,
      expeditionId,
    );

    return rows[0];
  }
}

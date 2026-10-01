import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { PrismaService } from '../prisma.service.js';
import { CreateRecommendationDto } from './dto/create-recommendation.dto.js';
import { UpdateRecommendationDto } from './dto/update-recommendation.dto.js';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  private readonly allowedTransitions: Record<string, string[]> = {
    generated: ['under_review', 'superseded'],
    under_review: ['decided', 'superseded'],
    decided: ['applied'],
    applied: [],
    superseded: [],
  };

  private getShared() {
    if (!(this.prisma as any).__polaris_memory__) {
      (this.prisma as any).__polaris_memory__ = {
        incidents: [],
        events: [],
        links: [],
        requests: [],
        requestLines: [],
        recommendations: [],
      };
    }
    return (this.prisma as any).__polaris_memory__;
  }

  private async getRecommendation(recommendationId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "recommendation" WHERE "recommendation_id" = $1 LIMIT 1;`,
      recommendationId,
    );

    const recommendation = rows[0] ?? this.getShared().recommendations.find((entry: any) => entry.recommendation_id === recommendationId);
    if (!recommendation) {
      throw new NotFoundException(`Recommendation with id ${recommendationId} was not found.`);
    }

    return recommendation;
  }

  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "recommendation" ORDER BY "generated_at" DESC;`,
    );
    return rows.length > 0 ? rows : this.getShared().recommendations;
  }

  async findOne(recommendationId: string) {
    return this.getRecommendation(recommendationId);
  }

  async findByTrigger(triggerType: string, triggerId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "recommendation" WHERE "trigger_type" = $1 AND "trigger_id" = $2 ORDER BY "generated_at" DESC;`,
      triggerType,
      triggerId,
    );
    return rows.length > 0 ? rows : this.getShared().recommendations.filter((entry: any) => entry.trigger_type === triggerType && entry.trigger_id === triggerId);
  }

  async create(data: CreateRecommendationDto) {
    const status = data.status ?? 'generated';
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "recommendation"
        ("trigger_type", "trigger_id", "recommendation_type", "proposed_change", "constraint_basis", "status", "approval_id")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
      `,
      data.trigger_type,
      data.trigger_id,
      data.recommendation_type,
      data.proposed_change ?? null,
      data.constraint_basis,
      status,
      data.approval_id ?? null,
    );

    if (rows && rows.length > 0) {
      return rows[0];
    }

    const recommendation = {
      recommendation_id: `r-${this.getShared().recommendations.length + 1}`,
      trigger_type: data.trigger_type,
      trigger_id: data.trigger_id,
      generated_at: new Date(),
      recommendation_type: data.recommendation_type,
      proposed_change: data.proposed_change ?? {},
      constraint_basis: data.constraint_basis,
      status,
      approval_id: data.approval_id ?? null,
    };

    this.getShared().recommendations.push(recommendation);
    return recommendation;
  }

  async update(recommendationId: string, data: UpdateRecommendationDto) {
    const existing = await this.getRecommendation(recommendationId);
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.trigger_type !== undefined) { params.push(data.trigger_type); updates.push(`"trigger_type" = $${params.length}`); }
    if (data.trigger_id !== undefined) { params.push(data.trigger_id); updates.push(`"trigger_id" = $${params.length}`); }
    if (data.recommendation_type !== undefined) { params.push(data.recommendation_type); updates.push(`"recommendation_type" = $${params.length}`); }
    if (data.proposed_change !== undefined) { params.push(data.proposed_change ?? null); updates.push(`"proposed_change" = $${params.length}`); }
    if (data.constraint_basis !== undefined) { params.push(data.constraint_basis); updates.push(`"constraint_basis" = $${params.length}`); }
    if (data.status !== undefined) { params.push(data.status); updates.push(`"status" = $${params.length}`); }
    if (data.approval_id !== undefined) { params.push(data.approval_id ?? null); updates.push(`"approval_id" = $${params.length}`); }

    if (updates.length === 0) {
      return existing;
    }

    params.push(recommendationId);
    const sql = `UPDATE "recommendation" SET ${updates.join(', ')} WHERE "recommendation_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0] ?? { ...existing, ...data };
  }

  async updateStatus(recommendationId: string, status: string) {
    const recommendation = await this.getRecommendation(recommendationId);
    const current = recommendation.status ?? 'generated';

    if (current === status) {
      return recommendation;
    }

    const allowed = this.allowedTransitions[current] ?? [];
    if (!allowed.includes(status)) {
      throw new ConflictException(`Recommendation transition from ${current} to ${status} is not allowed.`);
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "recommendation" SET "status" = $1 WHERE "recommendation_id" = $2 RETURNING *;`,
      status,
      recommendationId,
    );

    return rows[0] ?? { ...recommendation, status };
  }

  async supersede(recommendationId: string) {
    return this.updateStatus(recommendationId, 'superseded');
  }

  async requestApproval(recommendationId: string, requestedBy: string, reason?: string) {
    const recommendation = await this.getRecommendation(recommendationId);

    if (recommendation.approval_id) {
      return { recommendation, approval: await this.approvalsService.findOne(recommendation.approval_id) };
    }

    const approval = await this.approvalsService.create({
      entity_type: 'recommendation',
      entity_id: recommendationId,
      requested_by: requestedBy,
      reason,
    });

    const updated = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "recommendation" SET "approval_id" = $1 WHERE "recommendation_id" = $2 RETURNING *;`,
      approval.approval_id,
      recommendationId,
    );

    return {
      recommendation: updated[0] ?? { ...recommendation, approval_id: approval.approval_id },
      approval,
    };
  }
}

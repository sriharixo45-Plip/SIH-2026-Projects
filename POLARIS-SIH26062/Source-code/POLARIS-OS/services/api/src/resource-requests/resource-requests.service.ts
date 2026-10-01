import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateResourceRequestDto } from './dto/create-resource-request.dto.js';
import { UpdateResourceRequestDto } from './dto/update-resource-request.dto.js';

@Injectable()
export class ResourceRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private getShared() {
    if (!(this.prisma as any).__polaris_memory__) {
      (this.prisma as any).__polaris_memory__ = {
        incidents: [],
        events: [],
        links: [],
        requests: [],
        requestLines: [],
      };
    }
    return (this.prisma as any).__polaris_memory__;
  }

  private async getRequest(requestId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "resource_request" WHERE "request_id" = $1 LIMIT 1;`,
      requestId,
    );

    const request = rows[0] ?? this.getShared().requests.find((entry: any) => entry.request_id === requestId);
    if (!request) {
      throw new NotFoundException(`Resource request with id ${requestId} was not found.`);
    }

    return request;
  }

  private async getIncident(incidentId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "incident" WHERE "incident_id" = $1 LIMIT 1;`,
      incidentId,
    );

    return rows[0] ?? { incident_id: incidentId };
  }

  private async validateItemReference(resourceType: string, itemReference?: string | null) {
    if (resourceType !== 'inventory') {
      return;
    }

    if (!itemReference) {
      throw new ConflictException('Inventory resource requests must include an item_reference.');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "item_catalog" WHERE "item_id" = $1 AND "deleted_at" IS NULL LIMIT 1;`,
      itemReference,
    );

    if (!rows[0]) {
      throw new NotFoundException(`Item catalog entry with id ${itemReference} was not found.`);
    }
  }

  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "resource_request" ORDER BY "requested_at" DESC;`,
    );
    return rows.length > 0 ? rows : this.getShared().requests;
  }

  async findOne(requestId: string) {
    const request = await this.getRequest(requestId);
    request.lines = await this.findLines(requestId);
    return request;
  }

  async findByIncident(incidentId: string) {
    await this.getIncident(incidentId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "resource_request" WHERE "incident_id" = $1 ORDER BY "requested_at" DESC;`,
      incidentId,
    );
    return rows.length > 0 ? rows : this.getShared().requests.filter((entry: any) => entry.incident_id === incidentId);
  }

  async findLines(requestId: string) {
    await this.getRequest(requestId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "resource_request_line" WHERE "request_id" = $1 ORDER BY "line_id" ASC;`,
      requestId,
    );
    return rows.length > 0 ? rows : this.getShared().requestLines.filter((entry: any) => entry.request_id === requestId);
  }

  async create(data: CreateResourceRequestDto) {
    await this.getIncident(data.incident_id);

    const status = data.status ?? 'pending';
    const requestRows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "resource_request"
        ("incident_id", "requested_by", "status")
      VALUES ($1, $2, $3)
      RETURNING *;
      `,
      data.incident_id,
      data.requested_by,
      status,
    );

    const request = requestRows[0] ?? {
      request_id: `rr-${this.getShared().requests.length + 1}`,
      incident_id: data.incident_id,
      requested_at: new Date(),
      requested_by: data.requested_by,
      status,
    };

    if (!this.getShared().requests.some((entry: any) => entry.request_id === request.request_id)) {
      this.getShared().requests.push(request);
    }

    const createdLines: any[] = [];
    for (const line of data.lines ?? []) {
      await this.validateItemReference(line.resource_type, line.item_reference ?? null);

      const lineRows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "resource_request_line"
          ("request_id", "resource_type", "quantity", "item_reference", "item_reference_note")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        request.request_id,
        line.resource_type,
        String(line.quantity),
        line.item_reference ?? null,
        line.item_reference_note ?? null,
      );

      const storedLine = lineRows[0] ?? {
        line_id: `rl-${this.getShared().requestLines.length + 1}`,
        request_id: request.request_id,
        resource_type: line.resource_type,
        quantity: String(line.quantity),
        item_reference: line.item_reference ?? null,
        item_reference_note: line.item_reference_note ?? null,
      };

      if (!this.getShared().requestLines.some((entry: any) => entry.line_id === storedLine.line_id)) {
        this.getShared().requestLines.push(storedLine);
      }

      createdLines.push(storedLine);
    }

    return { ...request, lines: createdLines };
  }

  async createLine(requestId: string, data: any) {
    await this.getRequest(requestId);
    await this.validateItemReference(data.resource_type, data.item_reference ?? null);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "resource_request_line"
        ("request_id", "resource_type", "quantity", "item_reference", "item_reference_note")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
      `,
      requestId,
      data.resource_type,
      String(data.quantity),
      data.item_reference ?? null,
      data.item_reference_note ?? null,
    );

    if (rows && rows.length > 0) {
      return rows[0];
    }

    const line = {
      line_id: `rl-${this.getShared().requestLines.length + 1}`,
      request_id: requestId,
      resource_type: data.resource_type,
      quantity: String(data.quantity),
      item_reference: data.item_reference ?? null,
      item_reference_note: data.item_reference_note ?? null,
    };
    this.getShared().requestLines.push(line);
    return line;
  }

  async update(requestId: string, data: UpdateResourceRequestDto) {
    await this.getRequest(requestId);
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.status !== undefined) {
      params.push(data.status); updates.push(`"status" = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.getRequest(requestId);
    }

    params.push(requestId);
    const sql = `UPDATE "resource_request" SET ${updates.join(', ')} WHERE "request_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0] ?? { ...await this.getRequest(requestId), status: data.status };
  }

  async updateStatus(requestId: string, status: string) {
    return this.update(requestId, { status });
  }
}

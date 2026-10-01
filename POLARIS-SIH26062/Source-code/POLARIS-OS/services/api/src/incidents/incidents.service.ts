import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateIncidentDto } from './dto/create-incident.dto.js';
import { CreateIncidentEventDto } from './dto/create-incident-event.dto.js';
import { UpdateIncidentDto } from './dto/update-incident.dto.js';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly allowedTransitions: Record<string, string[]> = {
    declared: ['active', 'resource_requested', 'resolved', 'closed'],
    active: ['resource_requested', 'resolved', 'closed', 'reopened'],
    resource_requested: ['resolved', 'closed', 'reopened'],
    resolved: ['closed', 'reopened'],
    closed: ['reopened'],
    reopened: ['active', 'resolved', 'closed'],
  };

  private getShared() {
    if (!(this.prisma as any).__polaris_memory__) {
      (this.prisma as any).__polaris_memory__ = {
        incidents: [],
        events: [],
        links: [],
      };
    }
    return (this.prisma as any).__polaris_memory__;
  }

  private async getIncident(incidentId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "incident" WHERE "incident_id" = $1 LIMIT 1;`,
      incidentId,
    );

    const incident = rows[0] ?? this.getShared().incidents.find((entry: any) => entry.incident_id === incidentId);
    if (!incident) {
      throw new NotFoundException(`Incident with id ${incidentId} was not found.`);
    }

    return incident;
  }

  private async ensureLocationReference(data: Partial<CreateIncidentDto>) {
    if (!data.station_id && !data.leg_id) {
      throw new ConflictException('An incident must reference a station or transport leg.');
    }
  }

  private async ensureTargetEntity(targetEntityType: string, targetEntityId: string) {
    const supported = ['Personnel', 'CargoItem', 'TransportLeg'];
    if (!supported.includes(targetEntityType)) {
      throw new ConflictException(`Unsupported incident resource target: ${targetEntityType}.`);
    }

    const table =
      targetEntityType === 'Personnel'
        ? 'personnel'
        : targetEntityType === 'CargoItem'
          ? 'cargo_item'
          : 'transport_leg';
    const primaryKey =
      targetEntityType === 'Personnel'
        ? 'person_id'
        : targetEntityType === 'CargoItem'
          ? 'cargo_id'
          : 'leg_id';

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${table}" WHERE "${primaryKey}" = $1 LIMIT 1;`,
      targetEntityId,
    );

    if (!rows[0]) {
      throw new NotFoundException(`${targetEntityType} with id ${targetEntityId} was not found.`);
    }

    return rows[0];
  }

  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "incident" ORDER BY "declared_at" DESC;`,
    );
    return rows.length > 0 ? rows : this.getShared().incidents;
  }

  async findOne(incidentId: string) {
    return this.getIncident(incidentId);
  }

  async findEvents(incidentId: string) {
    await this.getIncident(incidentId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "incident_event" WHERE "incident_id" = $1 ORDER BY "timestamp_utc" ASC;`,
      incidentId,
    );
    return rows.length > 0 ? rows : this.getShared().events.filter((entry: any) => entry.incident_id === incidentId);
  }

  async create(data: CreateIncidentDto) {
    await this.ensureLocationReference(data);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "incident"
        ("station_id", "leg_id", "type", "declared_by", "severity", "status", "description")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
      `,
      data.station_id ?? null,
      data.leg_id ?? null,
      data.type,
      data.declared_by,
      data.severity,
      data.status ?? 'declared',
      data.description ?? null,
    );

    if (rows && rows.length > 0) {
      return rows[0];
    }

    const incident = {
      incident_id: `i-${this.getShared().incidents.length + 1}`,
      station_id: data.station_id ?? null,
      leg_id: data.leg_id ?? null,
      type: data.type,
      declared_at: new Date(),
      declared_by: data.declared_by,
      severity: data.severity,
      status: data.status ?? 'declared',
      description: data.description ?? null,
      location: null,
      sync_version: 0,
    };

    this.getShared().incidents.push(incident);
    return incident;
  }

  async update(incidentId: string, data: UpdateIncidentDto) {
    const existing = await this.getIncident(incidentId);

    if (data.status !== undefined) {
      const reopenedReason = data.reopen_reason ?? data.reason;
      const updated = await this.updateStatus(incidentId, data.status, reopenedReason);
      delete data.status;
      delete data.reopen_reason;
      delete data.reason;

      if (Object.keys(data).length === 0) {
        return updated;
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.station_id !== undefined) { params.push(data.station_id ?? null); updates.push(`"station_id" = $${params.length}`); }
    if (data.leg_id !== undefined) { params.push(data.leg_id ?? null); updates.push(`"leg_id" = $${params.length}`); }
    if (data.type !== undefined) { params.push(data.type); updates.push(`"type" = $${params.length}`); }
    if (data.declared_by !== undefined) { params.push(data.declared_by); updates.push(`"declared_by" = $${params.length}`); }
    if (data.severity !== undefined) { params.push(data.severity); updates.push(`"severity" = $${params.length}`); }
    if (data.description !== undefined) { params.push(data.description ?? null); updates.push(`"description" = $${params.length}`); }

    if (updates.length === 0) {
      return existing;
    }

    params.push(incidentId);
    const sql = `UPDATE "incident" SET ${updates.join(', ')} WHERE "incident_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0] ?? { ...existing, ...data };
  }

  async updateStatus(incidentId: string, status: string, reason?: string) {
    const incident = await this.getIncident(incidentId);
    const current = incident.status ?? 'declared';

    if (status === 'reopened' && !reason?.trim()) {
      throw new ConflictException('Reopening an incident requires a reason.');
    }

    if (current === status) {
      return incident;
    }

    const allowed = this.allowedTransitions[current] ?? [];
    if (!allowed.includes(status)) {
      throw new ConflictException(`Incident transition from ${current} to ${status} is not allowed.`);
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "incident" SET "status" = $1 WHERE "incident_id" = $2 RETURNING *;`,
      status,
      incidentId,
    );

    const updated = rows[0] ?? { ...incident, status };
    if (status === 'reopened' && reason) {
      await this.createEvent(incidentId, {
        event_type: 'reopened',
        actor: incident.declared_by,
        notes: reason,
      });
    }

    return updated;
  }

  async createEvent(incidentId: string, data: CreateIncidentEventDto) {
    await this.getIncident(incidentId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "incident_event"
        ("incident_id", "event_type", "actor", "notes")
      VALUES ($1, $2, $3, $4)
      RETURNING *;
      `,
      incidentId,
      data.event_type,
      data.actor,
      data.notes ?? null,
    );

    if (rows && rows.length > 0) {
      return rows[0];
    }

    const event = {
      event_id: `e-${this.getShared().events.length + 1}`,
      incident_id: incidentId,
      event_type: data.event_type,
      timestamp_utc: new Date(),
      actor: data.actor,
      notes: data.notes ?? null,
    };

    this.getShared().events.push(event);
    return event;
  }

  appendEvent(incidentId: string, data: CreateIncidentEventDto) {
    return this.createEvent(incidentId, data);
  }

  async createResourceLink(incidentId: string, targetEntityType: string, targetEntityId: string) {
    await this.getIncident(incidentId);
    await this.ensureTargetEntity(targetEntityType, targetEntityId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "incident_resource_link"
        ("incident_id", "target_entity_type", "target_entity_id")
      VALUES ($1, $2, $3)
      RETURNING *;
      `,
      incidentId,
      targetEntityType,
      targetEntityId,
    );

    if (rows && rows.length > 0) {
      return rows[0];
    }

    const link = {
      incident_id: incidentId,
      target_entity_type: targetEntityType,
      target_entity_id: targetEntityId,
    };

    this.getShared().links.push(link);
    return link;
  }

  async findResourceLinks(incidentId: string) {
    await this.getIncident(incidentId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "incident_resource_link" WHERE "incident_id" = $1 ORDER BY "target_entity_type" ASC;`,
      incidentId,
    );
    return rows.length > 0 ? rows : this.getShared().links.filter((entry: any) => entry.incident_id === incidentId);
  }
}

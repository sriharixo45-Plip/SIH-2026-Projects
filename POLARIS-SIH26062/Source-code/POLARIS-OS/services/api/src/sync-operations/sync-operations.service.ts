import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateSyncOperationDto } from './dto/create-sync-operation.dto.js';
import { randomUUID } from 'node:crypto';

const SELECT_SQL: Record<string, string> = {
  cargo_item: 'SELECT * FROM "cargo_item" WHERE "cargo_id" = $1 FOR UPDATE',
  transport_leg: 'SELECT * FROM "transport_leg" WHERE "leg_id" = $1 FOR UPDATE',
  inventory_stock: 'SELECT * FROM "inventory_stock" WHERE "stock_id" = $1 FOR UPDATE',
  personnel_assignment: 'SELECT * FROM "personnel_assignment" WHERE "assignment_id" = $1 FOR UPDATE',
  incident: 'SELECT * FROM "incident" WHERE "incident_id" = $1 FOR UPDATE',
  expedition: 'SELECT * FROM "expedition" WHERE "expedition_id" = $1 FOR UPDATE',
  approval: 'SELECT * FROM "approval" WHERE "approval_id" = $1 FOR UPDATE',
};

@Injectable()
export class SyncOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "sync_operation" ORDER BY "local_sequence_number" ASC;`);
  }

  async findOne(opId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "sync_operation" WHERE "op_id" = $1 LIMIT 1;`, opId);
    if (!rows[0]) throw new NotFoundException(`Sync operation with id ${opId} was not found.`);
    return rows[0];
  }

  async findByDevice(deviceId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "sync_operation" WHERE "device_id" = $1 ORDER BY "local_sequence_number" ASC;`, deviceId);
  }

  async findChanges(after: number, deviceId: string, userId: string) {
    if (!Number.isSafeInteger(after) || after < 0) throw new UnprocessableEntityException('The change cursor must be a non-negative integer.');
    const deviceRows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "assigned_station_id" FROM "sync_device" WHERE "device_id" = $1::uuid AND "assigned_user_id" = $2::uuid AND "status" = 'active' LIMIT 1;`, deviceId, userId);
    if (!deviceRows[0]) throw new NotFoundException('The active device was not found for this authenticated user.');
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT c."cursor", c."entity_type", c."entity_id", c."entity_version", c."deleted",
              CASE WHEN c."entity_type" = 'inventory_stock' THEN c."record" || jsonb_build_object('item_name', ic."name", 'unit', ic."unit") ELSE c."record" END AS "record",
              c."changed_at"
       FROM "sync_change" c
       JOIN "sync_device" d ON d."device_id" = $2 AND d."assigned_user_id" = $3 AND d."status" = 'active'
       LEFT JOIN "item_catalog" ic ON c."entity_type" = 'inventory_stock' AND ic."item_id" = (c."record"->>'item_catalog_id')::uuid
       WHERE c."cursor" > $1 AND d."assigned_station_id" = ANY(c."station_ids")
       ORDER BY c."cursor" ASC LIMIT 500;`,
      after,
      deviceId,
      userId,
    );
    await this.prisma.$executeRawUnsafe(`UPDATE "sync_device" SET "last_sync_at" = NOW() WHERE "device_id" = $1::uuid;`, deviceId);
    const changes = rows.map((row) => ({ ...row, cursor: Number(row.cursor) }));
    if (changes.length === 500) return { changes, cursor: changes[changes.length - 1].cursor };
    const watermarks = await this.prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(MAX("cursor"), $1)::bigint AS "cursor" FROM "sync_change";`, after);
    return { changes, cursor: Math.max(after, Number(watermarks[0]?.cursor ?? after)) };
  }

  private async ensureDevice(tx: any, deviceId: string, userId: string) {
    const rows = await tx.$queryRawUnsafe(`SELECT * FROM "sync_device" WHERE "device_id" = $1 AND "status" = 'active' LIMIT 1;`, deviceId);
    const device = rows[0];
    if (!device) throw new NotFoundException(`Active sync device ${deviceId} was not found.`);
    if (device.assigned_user_id !== userId) throw new ForbiddenException('This device is not assigned to the authenticated user.');
    return device;
  }

  private async currentEntity(tx: any, type: string, id: string) {
    const sql = SELECT_SQL[type];
    if (!sql) throw new UnprocessableEntityException(`Unsupported synchronizable entity type: ${type}.`);
    const rows = await tx.$queryRawUnsafe(sql, id);
    return rows[0] ?? null;
  }

  private async authorizeEntity(tx: any, device: any, data: CreateSyncOperationDto, current: any) {
    if (device.device_type !== 'station-pwa') return;
    const stationId = device.assigned_station_id;
    const p = data.payload as Record<string, any>;
    if (data.target_entity_type === 'inventory_stock' && current?.station_id !== stationId) {
      throw new ForbiddenException('This device cannot change inventory assigned to another station.');
    }
    if (data.target_entity_type === 'expedition') {
      const rows = await tx.$queryRawUnsafe(`SELECT 1 FROM "expedition_station" WHERE "expedition_id" = $1::uuid AND "station_id" = $2::uuid LIMIT 1;`, data.target_entity_id, stationId);
      if (!rows.length) throw new ForbiddenException('This expedition is not assigned to the device station.');
    }
    if (data.target_entity_type === 'personnel_assignment' && current?.station_id && current.station_id !== stationId) {
      throw new ForbiddenException('This personnel assignment belongs to another station.');
    }
    if (data.target_entity_type === 'incident' && data.operation_type === 'create') {
      if (p.station_id && p.station_id !== stationId) throw new ForbiddenException('This device cannot report an incident for another station.');
      if (!p.station_id && !p.leg_id) throw new UnprocessableEntityException('An incident must reference a station or transport leg.');
      if (!p.station_id && p.leg_id) {
        const rows = await tx.$queryRawUnsafe(`SELECT 1 FROM "transport_leg" l JOIN "expedition_station" es ON es."expedition_id" = l."expedition_id" WHERE l."leg_id" = $1 AND es."station_id" = $2 LIMIT 1;`, p.leg_id, stationId);
        if (!rows.length) throw new ForbiddenException('The incident transport leg is not assigned to this station.');
      }
    }
    let legId: string | null = null;
    if (data.target_entity_type === 'cargo_item') legId = current?.leg_id ?? (data.operation_type === 'create' ? p.leg_id : null);
    if (data.target_entity_type === 'personnel_assignment') legId = current?.leg_id ?? null;
    if (data.target_entity_type === 'transport_leg') legId = data.target_entity_id;
    const approvalEntityType = p.entity_type ?? current?.entity_type;
    const approvalEntityId = p.entity_id ?? current?.entity_id;
    if (data.target_entity_type === 'approval' && approvalEntityType !== 'PersonnelAssignment') {
      throw new ForbiddenException('Field devices can only request approval for a personnel assignment.');
    }
    if (data.target_entity_type === 'approval' && approvalEntityType === 'PersonnelAssignment') {
      const rows = await tx.$queryRawUnsafe(`SELECT "station_id", "leg_id" FROM "personnel_assignment" WHERE "assignment_id" = $1 LIMIT 1;`, approvalEntityId);
      if (!rows[0] || (rows[0].station_id && rows[0].station_id !== stationId)) throw new ForbiddenException('This assignment is not assigned to this station.');
      if (!rows[0].station_id && !rows[0].leg_id) throw new ForbiddenException('This assignment is not assigned to a station.');
      legId = rows[0].leg_id ?? null;
    }
    if (legId) {
      const rows = await tx.$queryRawUnsafe(`SELECT 1 FROM "transport_leg" l JOIN "expedition_station" es ON es."expedition_id" = l."expedition_id" WHERE l."leg_id" = $1 AND es."station_id" = $2 LIMIT 1;`, legId, stationId);
      if (!rows.length) throw new ForbiddenException('This record is not assigned to the device station.');
    }
  }

  private async apply(tx: any, data: CreateSyncOperationDto, userId: string, current: any) {
    const p = data.payload as Record<string, any>;
    const type = data.target_entity_type;
    const id = data.target_entity_id;
    if (type === 'incident' && data.operation_type === 'create') {
      const location = String(p.location ?? '').trim();
      const point = location.match(/^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i);
      if (!point || Number(point[1]) < -180 || Number(point[1]) > 180 || Number(point[2]) < -90 || Number(point[2]) > -55) {
        throw new UnprocessableEntityException('Field incidents require a valid Antarctic location as POINT(longitude latitude).');
      }
      const rows = await tx.$queryRawUnsafe(
        `INSERT INTO "incident" ("incident_id", "station_id", "leg_id", "type", "declared_by", "severity", "status", "description", "location") VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7, $8, $9::geography) RETURNING *;`,
        id, p.station_id ?? null, p.leg_id ?? null, p.type, userId, p.severity, p.status ?? 'declared', p.description ?? null, location,
      );
      if (!rows[0]) throw new UnprocessableEntityException('Incident creation did not return a record.');
      return rows[0];
    }
    if (type === 'approval' && data.operation_type === 'create') {
      const rows = await tx.$queryRawUnsafe(
        `INSERT INTO "approval" ("approval_id", "entity_type", "entity_id", "requested_by", "decision", "reason") VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING *;`,
        id, p.entity_type, p.entity_id, userId, p.reason ?? null,
      );
      return rows[0];
    }
    if (type === 'approval' && data.operation_type === 'update') {
      if (!current || !['approved', 'rejected'].includes(p.decision)) throw new UnprocessableEntityException('Approval decision is invalid.');
      if (current.decision !== 'pending') throw new UnprocessableEntityException('This approval has already been decided.');
      const rows = await tx.$queryRawUnsafe(`UPDATE "approval" SET "decision" = $1, "decided_by" = $2, "decided_at" = NOW(), "reason" = COALESCE($3, "reason") WHERE "approval_id" = $4 RETURNING *;`, p.decision, userId, p.reason ?? null, id);
      return rows[0];
    }
    if (type === 'cargo_item' && data.operation_type === 'create') {
      const legId = String(p.leg_id ?? '').trim();
      const trackingCode = String(p.tracking_code ?? '').trim();
      const description = String(p.description ?? '').trim();
      const category = String(p.category ?? '').trim();
      const weight = Number(p.weight);
      const volume = Number(p.volume);
      const hazardClass = p.hazard_class == null ? null : Number(p.hazard_class);
      if (!legId || !trackingCode || !description || !category || !Number.isFinite(weight) || weight <= 0 || !Number.isFinite(volume) || volume <= 0) {
        throw new UnprocessableEntityException('Cargo creation requires a leg, tracking code, description, category, and positive weight and volume.');
      }
      if (hazardClass !== null && (!Number.isInteger(hazardClass) || hazardClass < 1 || hazardClass > 9)) {
        throw new UnprocessableEntityException('Cargo hazard class must be between 1 and 9.');
      }
      if (p.status !== undefined && p.status !== 'packed') throw new UnprocessableEntityException('New cargo must start in packed status.');
      const rows = await tx.$queryRawUnsafe(
        `INSERT INTO "cargo_item" ("cargo_id", "tracking_code", "leg_id", "description", "category", "weight", "volume", "hazard_class", "is_return_cargo", "status", "sync_version") VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, 'packed', 0) RETURNING *;`,
        id, trackingCode, legId, description, category, weight, volume, hazardClass, p.is_return_cargo === true,
      );
      if (!rows[0]) throw new UnprocessableEntityException('Cargo creation did not return a record.');
      await tx.$queryRawUnsafe(
        `INSERT INTO "cargo_movement_event" ("cargo_id", "leg_id", "event_type", "timestamp_utc", "actor", "reason") VALUES ($1::uuid, $2::uuid, 'cargo_created', NOW(), $3::uuid, 'Cargo created offline or on field device') RETURNING *;`,
        id, legId, userId,
      );
      return rows[0];
    }
    if (!current) throw new NotFoundException(`${type} ${id} was not found.`);

    if (type === 'cargo_item' && ['status_change', 'update'].includes(data.operation_type)) {
      const valid = ['packed', 'in-transit', 'in-storage-at-station', 'delivered', 'damaged', 'returned'];
      if (!valid.includes(p.status)) throw new UnprocessableEntityException('Cargo status is invalid.');
      const transitions: Record<string, string[]> = {
        packed: ['in-transit', 'in-storage-at-station', 'damaged', 'returned'],
        'in-transit': ['in-storage-at-station', 'delivered', 'damaged', 'returned'],
        'in-storage-at-station': ['delivered', 'damaged', 'returned'], delivered: ['returned'], damaged: ['returned'], returned: [],
      };
      if (p.status !== current.status && !transitions[current.status]?.includes(p.status)) {
        throw new UnprocessableEntityException(`Cargo status transition from ${current.status} to ${p.status} is not allowed.`);
      }
      const rows = await tx.$queryRawUnsafe(`UPDATE "cargo_item" SET "status" = $1 WHERE "cargo_id" = $2 RETURNING *;`, p.status, id);
      if (p.status !== current.status) {
        await tx.$queryRawUnsafe(`INSERT INTO "cargo_movement_event" ("cargo_id", "leg_id", "event_type", "timestamp_utc", "actor", "reason") VALUES ($1, $2, 'status_change', NOW(), $3, $4) RETURNING *;`, id, current.leg_id, userId, p.reason ?? `Status changed to ${p.status}`);
      }
      return rows[0];
    }
    if (type === 'inventory_stock' && data.operation_type === 'update') {
      const kind = String(p.transaction_type ?? '').toLowerCase();
      const delta = Number(p.quantity_delta);
      const types = ['receipt', 'consumption', 'transfer_out', 'transfer_in', 'damage', 'loss', 'adjustment', 'return'];
      if (!types.includes(kind) || !Number.isFinite(delta) || delta <= 0) throw new UnprocessableEntityException('Inventory transaction payload is invalid.');
      if (kind === 'adjustment' && !String(p.reason ?? '').trim()) throw new UnprocessableEntityException('Adjustment transactions require a reason.');
      const signed = ['receipt', 'transfer_in', 'return'].includes(kind) ? delta : -delta;
      if (Number(current.quantity) + signed < 0) throw new UnprocessableEntityException('Inventory quantity cannot go negative.');
      const rows = await tx.$queryRawUnsafe(`UPDATE "inventory_stock" SET "quantity" = "quantity" + $1, "last_updated" = NOW() WHERE "stock_id" = $2 RETURNING *;`, signed, id);
      await tx.$queryRawUnsafe(`INSERT INTO "inventory_transaction" ("transaction_id", "stock_id", "transaction_type", "quantity_delta", "actor", "reason") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`, p.transaction_id ?? data.op_id, id, kind, delta, userId, p.reason ?? null);
      return rows[0];
    }
    if (type === 'personnel_assignment' && ['update', 'status_change'].includes(data.operation_type)) {
      const allowed = ['status', 'seat_berth_ref', 'start_date', 'end_date', 'station_id', 'leg_id'];
      const updates: string[] = [];
      const params: unknown[] = [];
      for (const key of allowed) if (p[key] !== undefined) { params.push(p[key]); updates.push(`"${key}" = $${params.length}`); }
      if (!updates.length) throw new UnprocessableEntityException('No supported assignment fields were supplied.');
      params.push(id);
      return (await tx.$queryRawUnsafe(`UPDATE "personnel_assignment" SET ${updates.join(', ')} WHERE "assignment_id" = $${params.length} RETURNING *;`, ...params))[0];
    }
    if (type === 'transport_leg' && ['update', 'status_change'].includes(data.operation_type)) {
      if (!['status'].every((key) => p[key] !== undefined) || !['planned', 'confirmed', 'delayed', 'departed', 'in-transit', 'arrived', 'cancelled', 'diverted'].includes(p.status)) throw new UnprocessableEntityException('Only a valid transport leg status change is supported by field sync.');
      return (await tx.$queryRawUnsafe(`UPDATE "transport_leg" SET "status" = $1 WHERE "leg_id" = $2 RETURNING *;`, p.status, id))[0];
    }
    if (type === 'expedition' && ['update', 'status_change'].includes(data.operation_type)) {
      if (!p.status || !['draft', 'planned', 'approved', 'in-progress', 'disrupted', 'completed', 'cancelled'].includes(p.status)) throw new UnprocessableEntityException('Expedition status is invalid.');
      return (await tx.$queryRawUnsafe(`UPDATE "expedition" SET "status" = $1 WHERE "expedition_id" = $2 RETURNING *;`, p.status, id))[0];
    }
    throw new UnprocessableEntityException(`Operation ${data.operation_type} is not supported for ${type}.`);
  }

  async applyConflictIncoming(tx: any, source: any, actorId: string) {
    const current = await this.currentEntity(tx, source.target_entity_type, source.target_entity_id);
    if (!current) throw new NotFoundException(`The conflicted ${source.target_entity_type} record no longer exists.`);
    const deviceRows = await tx.$queryRawUnsafe(`SELECT * FROM "sync_device" WHERE "device_id" = $1::uuid AND "status" = 'active' LIMIT 1;`, source.device_id);
    if (!deviceRows[0]) throw new NotFoundException('The originating field device is no longer active.');
    const sequenceRows = await tx.$queryRawUnsafe(`SELECT COALESCE(MAX("local_sequence_number"), 0)::int + 1 AS "next_sequence" FROM "sync_operation" WHERE "device_id" = $1::uuid;`, source.device_id);
    const data: CreateSyncOperationDto = {
      ...source,
      op_id: randomUUID(),
      performed_by: actorId,
      local_sequence_number: Number(sequenceRows[0]?.next_sequence ?? 1),
      base_version: Number(current.sync_version ?? 0),
      payload: source.payload ?? {},
    };
    await this.authorizeEntity(tx, deviceRows[0], data, current);
    const applied = await this.apply(tx, data, actorId, current);
    const rows = await tx.$queryRawUnsafe(`INSERT INTO "sync_operation" ("op_id", "device_id", "performed_by", "local_sequence_number", "target_entity_type", "target_entity_id", "operation_type", "payload", "base_version", "local_timestamp", "status", "applied_at") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::uuid,$7,$8::jsonb,$9,$10,'synced',NOW()) RETURNING *;`, data.op_id, data.device_id, actorId, data.local_sequence_number, data.target_entity_type, data.target_entity_id, data.operation_type, JSON.stringify(data.payload), data.base_version, data.local_timestamp ? new Date(data.local_timestamp) : null);
    await tx.$queryRawUnsafe(`INSERT INTO "audit_log" ("entity_type", "entity_id", "actor", "device_id", "action", "old_value", "new_value", "timestamp_utc", "sync_origin", "reason") VALUES ($1,$2::uuid,$3::uuid,$4::uuid,$5,$6::jsonb,$7::jsonb,NOW(),'offline',$8) RETURNING *;`, data.target_entity_type, data.target_entity_id, actorId, data.device_id, `conflict_${data.operation_type}`, JSON.stringify(current), JSON.stringify(applied), (data.payload as any)?.reason ?? 'Accepted incoming value during conflict resolution');
    return { operation: rows[0], authoritative: applied };
  }

  async create(data: CreateSyncOperationDto, authenticatedUserId: string) {
    if (!data.op_id || !data.device_id || !authenticatedUserId || !data.target_entity_type || !data.target_entity_id || !data.operation_type || !Number.isInteger(data.local_sequence_number)) {
      throw new UnprocessableEntityException('Operation identity, target, type and local sequence are required.');
    }
    const result = await this.prisma.$transaction(async (tx: any) => {
      const device = await this.ensureDevice(tx, data.device_id, authenticatedUserId);
      const duplicate = await tx.$queryRawUnsafe(`SELECT * FROM "sync_operation" WHERE "op_id" = $1 LIMIT 1;`, data.op_id);
      if (duplicate[0]) {
        if (duplicate[0].device_id !== data.device_id || duplicate[0].performed_by !== authenticatedUserId) throw new ForbiddenException('Operation ID was already used by another device or user.');
        const prior = duplicate[0];
        const entity = SELECT_SQL[prior.target_entity_type] ? await this.currentEntity(tx, prior.target_entity_type, prior.target_entity_id) : null;
        if (prior.status === 'conflicted') {
          const conflicts = await tx.$queryRawUnsafe(`SELECT * FROM "sync_conflict" WHERE "entity_type" = $1 AND "entity_id" = $2 AND "competing_operations" @> $3::jsonb ORDER BY "conflict_id" DESC LIMIT 1;`, prior.target_entity_type, prior.target_entity_id, JSON.stringify([prior.op_id]));
          return { operation: prior, authoritative: entity, duplicate: true, conflictId: conflicts[0]?.conflict_id, deleted: false };
        }
        return { operation: prior, authoritative: entity, duplicate: true };
      }
      const sequenceDuplicate = await tx.$queryRawUnsafe(`SELECT * FROM "sync_operation" WHERE "device_id" = $1 AND "local_sequence_number" = $2 LIMIT 1;`, data.device_id, data.local_sequence_number);
      if (sequenceDuplicate[0]) throw new UnprocessableEntityException('Local sequence number is already used by another operation.');

      const current = data.target_entity_type === 'incident' && data.operation_type === 'create' || data.target_entity_type === 'approval' && data.operation_type === 'create' || data.target_entity_type === 'cargo_item' && data.operation_type === 'create'
        ? null : await this.currentEntity(tx, data.target_entity_type, data.target_entity_id);
      await this.authorizeEntity(tx, device, data, current);
      if (current && data.base_version != null && Number(current.sync_version ?? 0) !== Number(data.base_version)) {
        const opRows = await tx.$queryRawUnsafe(`INSERT INTO "sync_operation" ("op_id", "device_id", "performed_by", "local_sequence_number", "target_entity_type", "target_entity_id", "operation_type", "payload", "base_version", "local_timestamp", "status") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,'conflicted') RETURNING *;`, data.op_id, data.device_id, authenticatedUserId, data.local_sequence_number, data.target_entity_type, data.target_entity_id, data.operation_type, JSON.stringify(data.payload ?? {}), data.base_version, data.local_timestamp ? new Date(data.local_timestamp) : null);
        const conflictRows = await tx.$queryRawUnsafe(`INSERT INTO "sync_conflict" ("entity_type", "entity_id", "competing_operations", "resolution") VALUES ($1,$2,$3::jsonb,NULL) RETURNING *;`, data.target_entity_type, data.target_entity_id, JSON.stringify([data.op_id]));
        return { operation: opRows[0], authoritative: current, conflictId: conflictRows[0]?.conflict_id };
      }
      if (!current && !['incident', 'approval'].includes(data.target_entity_type) && !(data.target_entity_type === 'cargo_item' && data.operation_type === 'create')) {
        const tombstone = await tx.$queryRawUnsafe(`SELECT * FROM "sync_change" WHERE "entity_type" = $1 AND "entity_id" = $2 AND "deleted" = TRUE ORDER BY "cursor" DESC LIMIT 1;`, data.target_entity_type, data.target_entity_id);
        if (tombstone.length) {
          const opRows = await tx.$queryRawUnsafe(`INSERT INTO "sync_operation" ("op_id", "device_id", "performed_by", "local_sequence_number", "target_entity_type", "target_entity_id", "operation_type", "payload", "base_version", "local_timestamp", "status") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,'conflicted') RETURNING *;`, data.op_id, data.device_id, authenticatedUserId, data.local_sequence_number, data.target_entity_type, data.target_entity_id, data.operation_type, JSON.stringify(data.payload ?? {}), data.base_version, data.local_timestamp ? new Date(data.local_timestamp) : null);
          const conflictRows = await tx.$queryRawUnsafe(`INSERT INTO "sync_conflict" ("entity_type", "entity_id", "competing_operations", "resolution") VALUES ($1,$2,$3::jsonb,NULL) RETURNING *;`, data.target_entity_type, data.target_entity_id, JSON.stringify([data.op_id]));
          return { operation: opRows[0], authoritative: tombstone[0].record, conflictId: conflictRows[0]?.conflict_id, deleted: true };
        }
      }
      if (current && data.base_version == null && data.operation_type !== 'create') throw new UnprocessableEntityException('base_version is required for updates.');
      const applied = await this.apply(tx, data, authenticatedUserId, current);
      const opRows = await tx.$queryRawUnsafe(`INSERT INTO "sync_operation" ("op_id", "device_id", "performed_by", "local_sequence_number", "target_entity_type", "target_entity_id", "operation_type", "payload", "base_version", "local_timestamp", "status", "applied_at") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,'synced',NOW()) RETURNING *;`, data.op_id, data.device_id, authenticatedUserId, data.local_sequence_number, data.target_entity_type, data.target_entity_id, data.operation_type, JSON.stringify(data.payload ?? {}), data.base_version, data.local_timestamp ? new Date(data.local_timestamp) : null);
      await tx.$queryRawUnsafe(`INSERT INTO "audit_log" ("entity_type", "entity_id", "actor", "device_id", "action", "old_value", "new_value", "timestamp_utc", "sync_origin", "reason") VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,NOW(),'offline',$8) RETURNING *;`, data.target_entity_type, data.target_entity_id, authenticatedUserId, data.device_id, data.operation_type, current ? JSON.stringify(current) : null, JSON.stringify(applied), (data.payload as any)?.reason ?? null);
      return { operation: opRows[0], authoritative: applied, duplicate: false };
    });
    if (result.conflictId) {
      throw new ConflictException({ status: 'conflicted', conflict_id: result.conflictId, operation: result.operation, authoritative: result.authoritative, deleted: !!result.deleted });
    }
    return { ...result.operation, duplicate: !!result.duplicate, authoritative: result.authoritative };
  }

  async applyOperation(opId: string) {
    const op = await this.findOne(opId);
    if (op.status === 'synced') return op;
    throw new ConflictException('Operations are applied atomically when received; pending server operations cannot be manually replayed.');
  }

  async rejectOperation(opId: string, _reason?: string) {
    const existing = await this.findOne(opId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`UPDATE "sync_operation" SET "status" = 'rejected', "applied_at" = NOW() WHERE "op_id" = $1 RETURNING *;`, opId);
    return rows[0] ?? existing;
  }
}

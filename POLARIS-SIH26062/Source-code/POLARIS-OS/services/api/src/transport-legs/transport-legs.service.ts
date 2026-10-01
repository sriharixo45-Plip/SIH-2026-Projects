import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateTransportLegDto } from './dto/create-transport-leg.dto.js';
import { UpdateTransportLegDto } from './dto/update-transport-leg.dto.js';

@Injectable()
export class TransportLegsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly allowedTransitions: Record<string, string[]> = {
    planned: ['confirmed', 'delayed', 'cancelled'],
    confirmed: ['delayed', 'departed', 'cancelled'],
    delayed: ['confirmed', 'departed', 'cancelled', 'diverted'],
    departed: ['in_transit', 'cancelled'],
    in_transit: ['arrived', 'delayed', 'cancelled', 'diverted'],
    arrived: [],
    cancelled: [],
    diverted: ['confirmed', 'delayed', 'departed'],
  };

  private pointToSql(point?: { latitude: number; longitude: number } | null) {
    if (!point) {
      return null;
    }

    return `POINT(${point.longitude} ${point.latitude})`;
  }

// In‑memory fallback removed – service now uses only PostgreSQL

  private async safeQuery<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const rows = await this.prisma.$queryRawUnsafe<T[]>(sql, ...params);
    return Array.isArray(rows) ? rows : [];
  }

  private async getLeg(legId: string) {
    const rows = await this.safeQuery<any>(
      `SELECT * FROM "transport_leg" WHERE "leg_id" = $1 LIMIT 1;`,
      legId,
    );

    const leg = rows[0];

    if (!leg) {
      throw new NotFoundException(`Transport leg with id ${legId} was not found.`);
    }

    return leg;
  }

  private validateCapacity(resource: any, data: Partial<CreateTransportLegDto>) {
    if (data.capacity_weight !== undefined) {
      const weight = Number(data.capacity_weight);
      if (weight > Number(resource.max_capacity_weight)) {
        throw new ConflictException('Transport leg capacity exceeds the resource capacity weight.');
      }
    }

    if (data.capacity_volume !== undefined) {
      const volume = Number(data.capacity_volume);
      if (volume > Number(resource.max_capacity_volume)) {
        throw new ConflictException('Transport leg capacity exceeds the resource capacity volume.');
      }
    }

    if (data.capacity_seats !== undefined) {
      const seats = Number(data.capacity_seats);
      if (seats > Number(resource.max_seats_berths)) {
        throw new ConflictException('Transport leg capacity exceeds the resource seat capacity.');
      }
    }
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "transport_leg" ORDER BY "planned_departure" ASC;`,
    );
  }

  async findByExpedition(expeditionId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "transport_leg" WHERE "expedition_id" = $1 ORDER BY "planned_departure" ASC;`,
      expeditionId,
    );
  }

  async findOne(legId: string) {
    return this.getLeg(legId);
  }

  async create(data: CreateTransportLegDto) {
    const expeditionRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "expedition" WHERE "expedition_id" = $1 LIMIT 1;`,
      data.expedition_id,
    );

    if (!expeditionRows[0]) {
      throw new NotFoundException(`Expedition with id ${data.expedition_id} was not found.`);
    }

    const resourceRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "transport_resource" WHERE "resource_id" = $1 LIMIT 1;`,
      data.transport_resource_id,
    );

    if (!resourceRows[0]) {
      throw new NotFoundException(`Transport resource with id ${data.transport_resource_id} was not found.`);
    }

    if (new Date(data.planned_arrival) < new Date(data.planned_departure)) {
      throw new ConflictException('planned_arrival must be after planned_departure.');
    }

    this.validateCapacity(resourceRows[0], data);

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        INSERT INTO "transport_leg"
          ("code", "expedition_id", "transport_resource_id", "mode", "origin", "origin_point", "destination", "destination_point", "planned_departure", "planned_arrival", "status", "capacity_weight", "capacity_volume", "capacity_seats", "hazard_restrictions", "allow_concurrent_leg")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *;
        `,
        data.code,
        data.expedition_id,
        data.transport_resource_id,
        data.mode,
        data.origin,
        this.pointToSql(data.origin_point),
        data.destination,
        this.pointToSql(data.destination_point),
        new Date(data.planned_departure),
        new Date(data.planned_arrival),
        data.status,
        data.capacity_weight !== undefined ? Number(data.capacity_weight) : null,
        data.capacity_volume !== undefined ? Number(data.capacity_volume) : null,
        data.capacity_seats !== undefined ? Number(data.capacity_seats) : null,
        data.hazard_restrictions ?? null,
        data.allow_concurrent_leg ?? false,
      );

      const created = rows[0];
      if (created) {
        // removed in‑memory push
      }
      return created;
    } catch (error: any) {
      if (error?.code === '23505' || error?.code === 'P2002') {
        throw new ConflictException('A transport leg with this code already exists.');
      }
      throw error;
    }
  }

  async update(legId: string, data: UpdateTransportLegDto) {
    const existing = await this.getLeg(legId);

    if (data.status !== undefined) {
      await this.updateStatus(legId, data.status);
      delete data.status;
    }

    if ((existing.status === 'departed' || existing.status === 'in_transit' || existing.status === 'arrived' || existing.status === 'cancelled') && Object.keys(data).length > 0) {
      throw new ConflictException('The leg manifest is frozen once departure has begun.');
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.code !== undefined) { params.push(data.code); updates.push(`"code" = $${params.length}`); }
    if (data.expedition_id !== undefined) { params.push(data.expedition_id); updates.push(`"expedition_id" = $${params.length}`); }
    if (data.transport_resource_id !== undefined) { params.push(data.transport_resource_id); updates.push(`"transport_resource_id" = $${params.length}`); }
    if (data.mode !== undefined) { params.push(data.mode); updates.push(`"mode" = $${params.length}`); }
    if (data.origin !== undefined) { params.push(data.origin); updates.push(`"origin" = $${params.length}`); }
    if (data.origin_point !== undefined) { params.push(this.pointToSql(data.origin_point)); updates.push(`"origin_point" = $${params.length}`); }
    if (data.destination !== undefined) { params.push(data.destination); updates.push(`"destination" = $${params.length}`); }
    if (data.destination_point !== undefined) { params.push(this.pointToSql(data.destination_point)); updates.push(`"destination_point" = $${params.length}`); }
    if (data.planned_departure !== undefined) { params.push(new Date(data.planned_departure)); updates.push(`"planned_departure" = $${params.length}`); }
    if (data.planned_arrival !== undefined) { params.push(new Date(data.planned_arrival)); updates.push(`"planned_arrival" = $${params.length}`); }
    if (data.capacity_weight !== undefined) { params.push(Number(data.capacity_weight)); updates.push(`"capacity_weight" = $${params.length}`); }
    if (data.capacity_volume !== undefined) { params.push(Number(data.capacity_volume)); updates.push(`"capacity_volume" = $${params.length}`); }
    if (data.capacity_seats !== undefined) { params.push(Number(data.capacity_seats)); updates.push(`"capacity_seats" = $${params.length}`); }
    if (data.hazard_restrictions !== undefined) { params.push(data.hazard_restrictions ?? null); updates.push(`"hazard_restrictions" = $${params.length}`); }
    if (data.allow_concurrent_leg !== undefined) { params.push(data.allow_concurrent_leg ?? false); updates.push(`"allow_concurrent_leg" = $${params.length}`); }

    if (updates.length === 0) {
      return this.getLeg(legId);
    }

    params.push(legId);
    const sql = `UPDATE "transport_leg" SET ${updates.join(', ')} WHERE "leg_id" = $${params.length} RETURNING *;`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return rows[0];
  }

  async updateStatus(legId: string, status: string) {
    const leg = await this.getLeg(legId);

    const nextStatus = status as keyof typeof this.allowedTransitions;
    if (!(nextStatus in this.allowedTransitions)) {
      throw new ConflictException(`Status ${status} is not a valid transport leg status.`);
    }

    if (leg.status === nextStatus) {
      return leg;
    }

    const allowed = this.allowedTransitions[leg.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ConflictException(
        `Transport leg transition from ${leg.status} to ${status} is not allowed.`,
      );
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "transport_leg" SET "status" = $1 WHERE "leg_id" = $2 RETURNING *;`,
      nextStatus,
      legId,
    );

    const updated = rows[0] ?? { ...leg, status: nextStatus };
    // removed in‑memory leg cache update

    if (['delayed', 'cancelled', 'diverted'].includes(nextStatus)) {
      await this.analyzeDisruption(updated);
    }

    return updated;
  }

  async getDisruptionImpact(legId: string) {
    const leg = await this.getLeg(legId);
    return this.analyzeDisruption(leg);
  }

  async analyzeDisruption(leg: any) {
    // 1. Identify CargoItems associated with that leg
    const cargoRows = await this.safeQuery(
      `SELECT * FROM "cargo_item" WHERE "leg_id" = $1;`,
      leg.leg_id,
    );
    const affectedCargo = [...cargoRows]; // in‑memory cargo merge removed

    // 2. Identify PersonnelAssignments associated with that leg
    const paRows = await this.safeQuery(
      `SELECT * FROM "personnel_assignment" WHERE "leg_id" = $1;`,
      leg.leg_id,
    );
    const affectedPersonnel = [...paRows]; // in‑memory personnel merge removed

    // 3. Identify destination station where applicable
    let destinationStation: any = null;
    if (leg.destination) {
      const stationRows = await this.safeQuery(
        `SELECT * FROM "station" WHERE "station_id"::text = $1 OR "code" = $1 OR "name" = $1 LIMIT 1;`,
        leg.destination,
      );
      destinationStation = stationRows[0];
    }
    const stationId = destinationStation?.station_id ?? null;

    // 4. Identify relevant InventoryStock records at that station & linked via transactions
    let stockRows: any[] = [];
    if (stationId) {
      stockRows = await this.safeQuery(
        `SELECT s.*, c.name as item_name, c.category as item_category 
         FROM "inventory_stock" s 
         LEFT JOIN "item_catalog" c ON s.item_catalog_id = c.item_id 
         WHERE s.station_id = $1;`,
        stationId,
      );

    }

    const txStockRows = await this.safeQuery(
      `SELECT DISTINCT s.*, c.name as item_name, c.category as item_category 
       FROM "inventory_stock" s 
       JOIN "inventory_transaction" t ON s.stock_id = t.stock_id 
       LEFT JOIN "item_catalog" c ON s.item_catalog_id = c.item_id 
       WHERE t.transport_leg_id = $1;`,
      leg.leg_id,
    );
    // in‑memory transaction‑stock fallback removed

    const allStocksMap = new Map<string, any>();
    for (const s of [...stockRows, ...txStockRows]) {
      if (s && s.stock_id && !allStocksMap.has(s.stock_id)) {
        allStocksMap.set(s.stock_id, s);
      }
    }

    // 5. Compare inventory against thresholds
    const affectedInventory = Array.from(allStocksMap.values()).map((stock) => {
      const quantity = Number(stock.quantity);
      const safetyMin = Number(stock.safety_stock_minimum);
      const reorderThreshold = Number(stock.reorder_threshold);

      let risk: 'below safety stock' | 'below reorder threshold' | 'no inventory risk';
      if (quantity <= safetyMin) {
        risk = 'below safety stock';
      } else if (quantity <= reorderThreshold) {
        risk = 'below reorder threshold';
      } else {
        risk = 'no inventory risk';
      }

      return {
        stock_id: stock.stock_id,
        station_id: stock.station_id,
        item_catalog_id: stock.item_catalog_id,
        item_name: stock.item_name ?? null,
        quantity,
        safety_stock_minimum: safetyMin,
        reorder_threshold: reorderThreshold,
        risk,
        risk_level: risk,
      };
    });

    // 6. Identified risks & overall severity
    const identifiedRisks: string[] = [];
    if (affectedCargo.length > 0) {
      identifiedRisks.push(`${affectedCargo.length} cargo item(s) affected on leg ${leg.code}`);
    }
    if (affectedPersonnel.length > 0) {
      identifiedRisks.push(`${affectedPersonnel.length} personnel assignment(s) affected on leg ${leg.code}`);
    }
    if (leg.status === 'cancelled') {
      identifiedRisks.push(`Transport leg ${leg.code} was cancelled; capacity lost`);
    } else if (leg.status === 'diverted') {
      identifiedRisks.push(`Transport leg ${leg.code} was diverted away from destination ${leg.destination}`);
    }

    const hasBelowSafety = affectedInventory.some((i) => i.risk === 'below safety stock');
    const hasBelowReorder = affectedInventory.some((i) => i.risk === 'below reorder threshold');

    if (hasBelowSafety) {
      identifiedRisks.push('Destination station inventory has fallen below safety stock minimum');
    }
    if (hasBelowReorder) {
      identifiedRisks.push('Destination station inventory has fallen below reorder threshold');
    }

    let overallSeverity: 'low' | 'moderate' | 'high' | 'critical';
    if (hasBelowSafety) {
      overallSeverity = 'critical';
    } else if (hasBelowReorder || leg.status === 'cancelled' || leg.status === 'diverted') {
      overallSeverity = 'high';
    } else if (affectedCargo.length > 0 || affectedPersonnel.length > 0) {
      overallSeverity = 'moderate';
    } else {
      overallSeverity = 'low';
    }

    // 7. Recommendation creation (idempotent, only on disruption with meaningful impact)
    let recommendation: any = null;
    const isDisrupted = ['delayed', 'cancelled', 'diverted'].includes(leg.status);
    const hasMeaningfulImpact = overallSeverity !== 'low' || affectedCargo.length > 0 || affectedPersonnel.length > 0;

    if (isDisrupted && hasMeaningfulImpact) {
      const existingRecRows = await this.safeQuery(
        `SELECT * FROM "recommendation" WHERE "trigger_type" = $1 AND "trigger_id" = $2 AND "status" NOT IN ('superseded') ORDER BY "generated_at" DESC LIMIT 1;`,
        'transport_disruption',
        leg.leg_id,
      );
      recommendation = existingRecRows[0];

      if (!recommendation) {
        let recType = 'alternate transport';
        let proposedChange: Record<string, any> = {};
        let constraintBasis = 'operational_continuity';

        if (hasBelowSafety || hasBelowReorder) {
          recType = 'stock transfer';
          constraintBasis = 'safety_stock_risk';
          proposedChange = {
            action: 'stock_transfer',
            target_station_id: stationId,
            critical_items: affectedInventory.filter((i) => i.risk !== 'no inventory risk').map((i) => i.item_catalog_id),
            recommendation: 'Initiate emergency inventory stock transfer to replenish depleted station reserves.',
          };
        } else if (leg.status === 'cancelled' || leg.status === 'diverted') {
          recType = 'alternate transport';
          constraintBasis = 'mission_itinerary';
          proposedChange = {
            action: 'alternate_transport',
            disrupted_leg_id: leg.leg_id,
            origin: leg.origin,
            destination: leg.destination,
            recommendation: 'Charter or dispatch alternate transport resource to fulfill disrupted itinerary.',
          };
        } else if (affectedPersonnel.length > 0) {
          recType = 'personnel reassignment';
          constraintBasis = 'personnel_rotation';
          proposedChange = {
            action: 'personnel_reassignment',
            leg_id: leg.leg_id,
            personnel_assignment_ids: affectedPersonnel.map((p) => p.assignment_id),
            recommendation: 'Reassign stranded personnel to next available transport leg window.',
          };
        } else {
          recType = 'expedited replacement';
          constraintBasis = 'supply_chain_sla';
          proposedChange = {
            action: 'expedited_replacement',
            leg_id: leg.leg_id,
            cargo_tracking_codes: affectedCargo.map((c) => c.tracking_code),
            recommendation: 'Reschedule delivery priority and expedite replacement cargo shipment.',
          };
        }

        const recRows = await this.safeQuery(
          `
          INSERT INTO "recommendation"
            ("trigger_type", "trigger_id", "recommendation_type", "proposed_change", "constraint_basis", "status")
          VALUES ($1, $2, $3, $4, $5, 'generated')
          RETURNING *;
          `,
          'transport_disruption',
          leg.leg_id,
          recType,
          JSON.stringify(proposedChange),
          constraintBasis,
        );

        // recommendation fallback removed – DB row already returned
      }
    }

    // 8. Incident creation (idempotent, only on high/critical impact)
    let incident: any = null;
    const isHighOrCritical = overallSeverity === 'high' || overallSeverity === 'critical';

    if (isDisrupted && isHighOrCritical) {
      const existingIncRows = await this.safeQuery(
        `SELECT * FROM "incident" WHERE "leg_id" = $1 AND "status" IN ('declared', 'active', 'resource_requested') LIMIT 1;`,
        leg.leg_id,
      );
      incident = existingIncRows[0];
      if (!incident) {
        const declaredBy = leg.created_by; // use real creator only
        if (declaredBy) {
          const desc = `Transport leg ${leg.code} disruption (${leg.status}) resulted in ${overallSeverity} operational severity. Risks: ${identifiedRisks.join('; ')}`;
          const incRows = await this.safeQuery(
            `INSERT INTO "incident" ("station_id", "leg_id", "type", "declared_by", "severity", "status", "description") VALUES ($1, $2, 'transport_disruption', $3, $4, 'declared', $5) RETURNING *;`,
            stationId,
            leg.leg_id,
            declaredBy,
            overallSeverity,
            desc,
          );
          incident = incRows[0];
          await this.safeQuery(
            `INSERT INTO "incident_event" ("incident_id", "event_type", "actor", "notes") VALUES ($1, 'declared', $2, 'Incident automatically declared due to transport disruption') RETURNING *;`,
            incident.incident_id,
            declaredBy,
          );
        }
      }
    }
    return {
      transport_leg: leg,
      disruption_status: leg.status,
      affected_cargo: affectedCargo,
      affected_personnel_assignments: affectedPersonnel,
      affected_inventory: affectedInventory,
      identified_risks: identifiedRisks,
      overall_severity: overallSeverity,
      recommendation,
      incident,
      incident_creation_skipped: incident === null && isDisrupted && isHighOrCritical && !leg.created_by,
    };
  }

  async remove(legId: string) {
    await this.getLeg(legId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `DELETE FROM "transport_leg" WHERE "leg_id" = $1 RETURNING *;`,
      legId,
    );

    // removed in‑memory leg cache removal

    return rows[0];
  }
}

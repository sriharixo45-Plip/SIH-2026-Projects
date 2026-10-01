import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateSyncConflictDto } from './dto/create-sync-conflict.dto.js';
import { SyncOperationsService } from '../sync-operations/sync-operations.service.js';

@Injectable()
export class SyncConflictsService {
  constructor(private readonly prisma: PrismaService, private readonly syncOperations: SyncOperationsService) {}

  private async getConflict(conflictId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "sync_conflict" WHERE "conflict_id" = $1 LIMIT 1;`,
      conflictId,
    );

    const conflict = rows[0];
    if (!conflict) {
      throw new NotFoundException(`Sync conflict with id ${conflictId} was not found.`);
    }

    return conflict;
  }

  async findAll() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT c.*,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'op_id', o."op_id", 'device_id', o."device_id", 'performed_by', o."performed_by",
                'local_sequence_number', o."local_sequence_number", 'operation_type', o."operation_type",
                'payload', o."payload", 'base_version', o."base_version", 'local_timestamp', o."local_timestamp",
                'status', o."status") ORDER BY o."local_sequence_number")
                FROM "sync_operation" o
                WHERE c."competing_operations" @> jsonb_build_array(o."op_id"::text)), '[]'::jsonb) AS "operation_details",
              (SELECT ch."record" FROM "sync_change" ch WHERE ch."entity_type" = c."entity_type" AND ch."entity_id" = c."entity_id" AND ch."deleted" = FALSE ORDER BY ch."cursor" DESC LIMIT 1) AS "server_value"
       FROM "sync_conflict" c ORDER BY c."resolved_at" NULLS FIRST, c."conflict_id" DESC;`,
    );
  }

  async findOne(conflictId: string) {
    return this.getConflict(conflictId);
  }

  async create(data: CreateSyncConflictDto) {
    if (!data.entity_type || !data.entity_id || !Array.isArray(data.competing_operations) || data.competing_operations.length === 0) {
      throw new ConflictException('entity_type, entity_id, and competing_operations are required.');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "sync_conflict"
        ("entity_type", "entity_id", "competing_operations", "resolution")
      VALUES ($1, $2::uuid, $3::jsonb, NULL)
      RETURNING *;
      `,
      data.entity_type,
      data.entity_id,
      JSON.stringify(data.competing_operations),
    );

    if (rows[0]) {
      return rows[0];
    }
    throw new ConflictException('The conflict could not be recorded in the database.');
  }

  async resolve(conflictId: string, resolution: 'accepted_server' | 'accepted_incoming', resolvedBy: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const conflicts: any[] = await tx.$queryRawUnsafe(`SELECT * FROM "sync_conflict" WHERE "conflict_id" = $1::uuid FOR UPDATE;`, conflictId);
      const conflict = conflicts[0];
      if (!conflict) throw new NotFoundException(`Sync conflict with id ${conflictId} was not found.`);
      if (conflict.resolution) throw new ConflictException('This conflict has already been resolved.');
      const operationIds: string[] = Array.isArray(conflict.competing_operations) ? conflict.competing_operations : JSON.parse(conflict.competing_operations);
      const operations: any[] = await tx.$queryRawUnsafe(`SELECT o."op_id", o."status", d."assigned_user_id", d."assigned_station_id" FROM "sync_operation" o JOIN "sync_device" d ON d."device_id" = o."device_id" WHERE o."op_id" = ANY($1::uuid[]);`, operationIds);
      const assignment: any[] = await tx.$queryRawUnsafe(`SELECT BOOL_OR(r."name" = 'HQ Administrator') AS hq_admin FROM "user_role_assignment" ura JOIN "role" r ON r."role_id" = ura."role_id" WHERE ura."user_id" = $1::uuid AND ura."valid_from" <= NOW() AND (ura."valid_to" IS NULL OR ura."valid_to" > NOW());`, resolvedBy);
      const isOwner = operations.length > 0 && operations.every((operation) => operation.assigned_user_id === resolvedBy);
      if (!isOwner && !assignment[0]?.hq_admin) throw new ConflictException('Only the originating field operator or an HQ Administrator can resolve this conflict.');
      for (const operation of operations) {
        if (operation.status === 'conflicted') {
          if (resolution === 'accepted_incoming') {
            const sourceRows = await tx.$queryRawUnsafe(`SELECT * FROM "sync_operation" WHERE "op_id" = $1::uuid LIMIT 1;`, operation.op_id);
            await this.syncOperations.applyConflictIncoming(tx, sourceRows[0], resolvedBy);
          }
          await tx.$queryRawUnsafe(`UPDATE "sync_operation" SET "status" = 'rejected', "applied_at" = NOW() WHERE "op_id" = $1::uuid;`, operation.op_id);
        }
      }
      const rows: any[] = await tx.$queryRawUnsafe(`UPDATE "sync_conflict" SET "resolution" = $1, "resolved_by" = $2::uuid, "resolved_at" = NOW() WHERE "conflict_id" = $3::uuid RETURNING *;`, resolution, resolvedBy, conflictId);
      return rows[0];
    });
  }
}

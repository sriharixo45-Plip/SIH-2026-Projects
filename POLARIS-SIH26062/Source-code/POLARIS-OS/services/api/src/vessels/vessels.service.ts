import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

const validStatuses = new Set(['live', 'recent', 'stale']);
const mmsiPattern = /^\d{9}$/;

@Injectable()
export class VesselService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: string, status?: string) {
    if (status && !validStatuses.has(status)) throw new UnprocessableEntityException('status must be live, recent, or stale.');
    const search = query?.trim() ? `%${query.trim().slice(0, 80)}%` : null;
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT v."mmsi", v."ship_name", ST_Y(v."position"::geometry) AS "latitude", ST_X(v."position"::geometry) AS "longitude", v."speed_over_ground", v."course_over_ground", v."true_heading", v."received_at", v."source",
        CASE WHEN v."received_at" >= NOW() - INTERVAL '2 minutes' THEN 'live' WHEN v."received_at" >= NOW() - INTERVAL '30 minutes' THEN 'recent' ELSE 'stale' END AS "status"
       FROM "vessel_position" v
       WHERE ($1::text IS NULL OR v."mmsi" ILIKE $1 OR COALESCE(v."ship_name", '') ILIKE $1)
         AND ($2::text IS NULL OR ($2 = 'live' AND v."received_at" >= NOW() - INTERVAL '2 minutes') OR ($2 = 'recent' AND v."received_at" < NOW() - INTERVAL '2 minutes' AND v."received_at" >= NOW() - INTERVAL '30 minutes') OR ($2 = 'stale' AND v."received_at" < NOW() - INTERVAL '30 minutes'))
       ORDER BY v."received_at" DESC LIMIT 500;`, search, status ?? null,
    );
  }

  async findOne(mmsi: string) {
    if (!mmsiPattern.test(mmsi)) throw new UnprocessableEntityException('mmsi must contain nine digits.');
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "mmsi", "ship_name", ST_Y("position"::geometry) AS "latitude", ST_X("position"::geometry) AS "longitude", "speed_over_ground", "course_over_ground", "true_heading", "received_at", "source"
       FROM "vessel_position" WHERE "mmsi" = $1 LIMIT 1;`, mmsi,
    );
    if (!rows[0]) throw new NotFoundException('Vessel has no received AIS position.');
    return rows[0];
  }

  async track(mmsi: string, requestedLimit?: string) {
    if (!mmsiPattern.test(mmsi)) throw new UnprocessableEntityException('mmsi must contain nine digits.');
    const limit = requestedLimit ? Number(requestedLimit) : 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new UnprocessableEntityException('limit must be an integer between 1 and 1000.');
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "mmsi", "ship_name", ST_Y("position"::geometry) AS "latitude", ST_X("position"::geometry) AS "longitude", "speed_over_ground", "course_over_ground", "true_heading", "received_at", "source"
       FROM "vessel_position_history" WHERE "mmsi" = $1 ORDER BY "received_at" DESC LIMIT $2;`, mmsi, limit,
    );
  }
}

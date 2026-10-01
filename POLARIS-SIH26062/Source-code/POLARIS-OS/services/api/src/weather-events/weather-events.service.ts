import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class WeatherEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.weatherEvent.findMany({
      orderBy: {
        logged_at: 'desc',
      },
    });
  }

  async findByStation(stationId: string) {
    return this.prisma.weatherEvent.findMany({
      where: {
        station_id: stationId,
      },
      orderBy: {
        logged_at: 'desc',
      },
    });
  }

  async create(data: {
    station_id?: string;
    event_type: string;
    severity: string;
    logged_by: string;
    source: string;
    notes?: string;
  }) {
    return this.prisma.weatherEvent.create({
      data: {
        station_id: data.station_id,
        event_type: data.event_type,
        severity: data.severity,
        logged_by: data.logged_by,
        source: data.source as any,
        notes: data.notes,
      },
    });
  }
}
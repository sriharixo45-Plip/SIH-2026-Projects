import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';
import { PrismaService } from '../prisma.service.js';

type AisEnvelope = {
  MessageType?: string;
  MetaData?: { MMSI?: number | string; ShipName?: string; Latitude?: number; Longitude?: number };
  Message?: { PositionReport?: { Sog?: number; Cog?: number; TrueHeading?: number; Timestamp?: number; Valid?: boolean } };
};
type VesselFix = { mmsi: string; name: string | null; latitude: number; longitude: number; speed: number | null; course: number | null; heading: number | null; observedAt: Date };

export function normalizeAisPosition(message: AisEnvelope, receivedAt = new Date()): VesselFix | null {
  if (message.MessageType !== 'PositionReport') return null;
  const metadata = message.MetaData;
  const position = message.Message?.PositionReport;
  const mmsi = metadata?.MMSI == null ? '' : String(metadata.MMSI);
  const latitude = metadata?.Latitude;
  const longitude = metadata?.Longitude;
  if (!/^\d{9}$/.test(mmsi) || typeof latitude !== 'number' || typeof longitude !== 'number' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > -50 || longitude < -180 || longitude > 180 || position?.Valid === false) return null;
  // AIS PositionReport.Timestamp is the UTC second within a minute (0–59), not an epoch.
  // Use the server receive time for freshness; preserve no invented report date.
  if (position?.Timestamp != null && (!Number.isInteger(position.Timestamp) || position.Timestamp < 0 || position.Timestamp > 59)) return null;
  const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  return { mmsi, name: metadata?.ShipName?.trim() || null, latitude, longitude, speed: numeric(position?.Sog), course: numeric(position?.Cog), heading: numeric(position?.TrueHeading), observedAt: receivedAt };
}

@Injectable()
export class AisStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AisStreamService.name);
  private socket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private stopped = false;
  private attempts = 0;
  private state: 'not_configured' | 'connecting' | 'live' | 'reconnecting' = 'not_configured';
  private lastMessageAt: Date | null = null;
  private lastError: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!process.env.AISSTREAM_API_KEY?.trim()) {
      this.logger.warn('AIS stream is disabled: AISSTREAM_API_KEY is not configured.');
      return;
    }
    this.connect();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.removeAllListeners();
    this.socket?.close();
  }

  status() {
    return { provider: 'AISStream', state: this.state, configured: !!process.env.AISSTREAM_API_KEY?.trim(), last_message_at: this.lastMessageAt?.toISOString() ?? null, last_error: this.lastError };
  }

  private connect() {
    if (this.stopped || !process.env.AISSTREAM_API_KEY?.trim()) return;
    this.state = this.attempts ? 'reconnecting' : 'connecting';
    const socket = new WebSocket('wss://stream.aisstream.io/v0/stream', { perMessageDeflate: true, handshakeTimeout: 15_000 });
    this.socket = socket;
    const connectTimeout = setTimeout(() => socket.terminate(), 20_000);
    socket.once('open', () => {
      clearTimeout(connectTimeout);
      this.attempts = 0;
      this.state = 'live';
      this.lastError = null;
      socket.send(JSON.stringify({
        APIKey: process.env.AISSTREAM_API_KEY,
        BoundingBoxes: [[[-90, -180], [-50, 180]]],
        FilterMessageTypes: ['PositionReport'],
      }));
    });
    socket.on('message', (frame) => {
      void this.handleMessage(frame.toString());
    });
    socket.on('error', (error) => {
      this.lastError = error.message;
      this.logger.warn(`AIS stream error: ${error.message}`);
    });
    socket.once('close', (code, reason) => {
      clearTimeout(connectTimeout);
      if (this.stopped) return;
      this.state = 'reconnecting';
      this.lastError = `WebSocket closed (${code}): ${reason.toString().slice(0, 120)}`;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.attempts += 1;
    const base = Math.min(60_000, 1_000 * 2 ** Math.min(this.attempts - 1, 6));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, base + Math.floor(Math.random() * Math.min(5_000, base / 4)));
  }

  private async handleMessage(raw: string) {
    let decoded: AisEnvelope;
    try { decoded = JSON.parse(raw) as AisEnvelope; }
    catch { this.logger.warn('Ignoring malformed AIS stream frame.'); return; }
    const fix = normalizeAisPosition(decoded);
    if (!fix) return;
    try {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "vessel_position" ("mmsi", "ship_name", "position", "speed_over_ground", "course_over_ground", "true_heading", "received_at", "source")
           VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8, 'aisstream')
           ON CONFLICT ("mmsi") DO UPDATE SET "ship_name" = COALESCE(EXCLUDED."ship_name", "vessel_position"."ship_name"), "position" = EXCLUDED."position", "speed_over_ground" = EXCLUDED."speed_over_ground", "course_over_ground" = EXCLUDED."course_over_ground", "true_heading" = EXCLUDED."true_heading", "received_at" = EXCLUDED."received_at", "source" = EXCLUDED."source"
           WHERE EXCLUDED."received_at" >= "vessel_position"."received_at";`,
          fix.mmsi, fix.name, fix.longitude, fix.latitude, fix.speed, fix.course, fix.heading, fix.observedAt,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "vessel_position_history" ("mmsi", "ship_name", "position", "speed_over_ground", "course_over_ground", "true_heading", "received_at", "source")
           VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8, 'aisstream') ON CONFLICT ("mmsi", "received_at") DO NOTHING;`,
          fix.mmsi, fix.name, fix.longitude, fix.latitude, fix.speed, fix.course, fix.heading, fix.observedAt,
        );
      });
      this.lastMessageAt = new Date();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to persist AIS position';
      this.logger.error('Failed to persist AIS vessel position.', error instanceof Error ? error.stack : undefined);
    }
  }
}

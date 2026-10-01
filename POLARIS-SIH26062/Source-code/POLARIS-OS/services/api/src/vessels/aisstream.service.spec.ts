import { describe, expect, it } from 'vitest';
import { normalizeAisPosition } from './aisstream.service.js';

describe('AISStream position normalization', () => {
  const receivedAt = new Date('2026-09-28T10:00:00.000Z');

  it('accepts real-shaped Antarctic position reports and normalizes MMSI and timestamp', () => {
    const fix = normalizeAisPosition({
      MessageType: 'PositionReport',
      MetaData: { MMSI: 123456789, ShipName: 'Polar Research Vessel', Latitude: -70.5, Longitude: 12.25 },
      Message: { PositionReport: { Sog: 8.4, Cog: 90, TrueHeading: 92, Timestamp: 40, Valid: true } },
    }, receivedAt);
    expect(fix).toMatchObject({ mmsi: '123456789', name: 'Polar Research Vessel', latitude: -70.5, longitude: 12.25, speed: 8.4, course: 90, heading: 92 });
    expect(fix?.observedAt).toEqual(receivedAt);
  });

  it('ignores non-position, invalid, non-Antarctic, and malformed AIS data', () => {
    expect(normalizeAisPosition({ MessageType: 'SubscriptionConfirmation' }, receivedAt)).toBeNull();
    expect(normalizeAisPosition({ MessageType: 'PositionReport', MetaData: { MMSI: 123, Latitude: -70, Longitude: 10 } }, receivedAt)).toBeNull();
    expect(normalizeAisPosition({ MessageType: 'PositionReport', MetaData: { MMSI: 123456789, Latitude: -40, Longitude: 10 } }, receivedAt)).toBeNull();
    expect(normalizeAisPosition({ MessageType: 'PositionReport', MetaData: { MMSI: 123456789, Latitude: -70, Longitude: 10 }, Message: { PositionReport: { Valid: false } } }, receivedAt)).toBeNull();
    expect(normalizeAisPosition({ MessageType: 'PositionReport', MetaData: { MMSI: 123456789, Latitude: -70, Longitude: 10 }, Message: { PositionReport: { Timestamp: 300 } } }, receivedAt)).toBeNull();
  });
});

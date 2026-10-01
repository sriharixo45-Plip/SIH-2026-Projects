import type { Station, TransportLeg } from '../types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isDatabaseId(value?: string | null): boolean {
  return !!value && UUID_PATTERN.test(value)
}

export function recordLabel(humanLabel?: string | null, id?: string | null, fallback = 'Unresolved record'): string {
  if (humanLabel && !isDatabaseId(humanLabel)) return humanLabel
  if (id && !isDatabaseId(id)) return id
  if (id && isDatabaseId(id)) return `Record · …${id.slice(-8)}`
  if (humanLabel && isDatabaseId(humanLabel)) return `Record · …${humanLabel.slice(-8)}`
  return fallback
}

export function isSupportedIndianStation(station?: Pick<Station, 'name' | 'code'> | null): boolean {
  if (!station) return false
  const name = (station.name || '').trim().toLowerCase()
  const code = (station.code || '').trim().toLowerCase()
  if (name) return name === 'maitri' || name === 'bharati'
  return code === 'maitri' || code === 'bharati'
}

function supportedStationLabel(station: Pick<Station, 'name' | 'code'>): string {
  const name = (station.name || '').trim().toLowerCase()
  const code = (station.code || '').trim().toLowerCase()
  return name === 'maitri' || code === 'maitri' ? 'Maitri' : 'Bharati'
}

export function stationLabelById(stationId: string | null | undefined, stations: Station[]): string {
  if (!stationId) return 'Station mapping unavailable'
  const station = stations.find((item) => item.station_id === stationId)
  if (!station) return 'Station mapping unavailable'
  if (!isSupportedIndianStation(station)) return `${recordLabel(station.name, station.code || station.station_id, 'Unnamed station')} — Unmapped Station`
  return supportedStationLabel(station)
}

export function stationLabelByReference(reference: string | null | undefined, stations: Station[], endpoint: 'origin' | 'destination' = 'origin'): string {
  if (!reference) return `${endpoint === 'origin' ? 'Origin' : 'Destination'} unavailable`
  const normalized = reference.trim().toLowerCase()
  const station = stations.find((item) => item.station_id === reference || (item.name || '').trim().toLowerCase() === normalized || (item.code || '').trim().toLowerCase() === normalized)
  if (station) return isSupportedIndianStation(station) ? supportedStationLabel(station) : `${recordLabel(station.name, station.code || station.station_id, 'Unnamed station')} — Unmapped Station`
  if (isDatabaseId(reference)) return 'Station mapping unavailable'
  if (normalized === 'maitri' || normalized === 'bharati') return reference
  return `${reference} — Unmapped Station`
}

export function transportLabelById(legId: string | null | undefined, legs: TransportLeg[]): string {
  if (!legId) return 'Transport unavailable'
  const leg = legs.find((item) => item.leg_id === legId)
  if (!leg) return recordLabel(null, legId, 'Transport unavailable')
  return recordLabel(leg.code, leg.leg_id, 'Transport unavailable')
}

export function safeReference(value?: string | null, fallback = 'Not provided'): string {
  if (!value) return fallback
  return recordLabel(value, value, fallback)
}

export function redactDatabaseIds(value: string): string {
  return value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, (id) => `…${id.slice(-8)}`)
}

export function formatDateTime(value?: string | null, compact = false): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not provided'
  const format = compact
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' })
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' })
  return `${format.format(new Date(value))}${compact ? '' : ' IST'}`
}

export function formatDate(value?: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not provided'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value))
}

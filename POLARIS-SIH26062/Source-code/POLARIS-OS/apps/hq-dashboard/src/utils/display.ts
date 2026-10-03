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

export type CanonicalStation = 'NCPOR' | 'Maitri' | 'Bharati' | 'Himadri'

const stationAliases: Record<CanonicalStation, string[]> = {
  NCPOR: ['NCPOR', 'CENTRAL OPERATIONS', 'CENTRAL OPS', 'NATIONAL CENTRE FOR POLAR AND OCEAN RESEARCH'],
  Maitri: ['MAITRI', 'MAITRI STATION', 'MAITRI BASE'],
  Bharati: ['BHARATI', 'BHARATI STATION', 'BHARATI BASE'],
  Himadri: ['HIMADRI', 'HIMADRI STATION', 'HIMADRI BASE'],
}

function stationToken(value?: string | null): string {
  return (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function canonicalStationName(station?: Pick<Station, 'name' | 'code'> | string | null): CanonicalStation | null {
  const values = typeof station === 'string' ? [station] : [station?.code, station?.name]
  const tokens = values.map(stationToken).filter(Boolean)
  for (const [canonical, aliases] of Object.entries(stationAliases) as [CanonicalStation, string[]][]) {
    if (aliases.some((alias) => tokens.includes(stationToken(alias)))) return canonical
  }
  return null
}

export function isSupportedIndianStation(station?: Pick<Station, 'name' | 'code'> | null): boolean {
  const canonical = canonicalStationName(station)
  return canonical === 'Maitri' || canonical === 'Bharati'
}

export function stationLabelById(stationId: string | null | undefined, stations: Station[]): string {
  if (!stationId) return 'Station reference unavailable'
  const station = stations.find((item) => item.station_id === stationId)
  if (!station) return 'Station reference unavailable'
  return canonicalStationName(station) || 'Station reference data requires reconciliation'
}

export function stationLabelByReference(reference: string | null | undefined, stations: Station[], endpoint: 'origin' | 'destination' = 'origin'): string {
  if (!reference) return `${endpoint === 'origin' ? 'Origin' : 'Destination'} unavailable`
  const normalized = reference.trim().toLowerCase()
  const station = stations.find((item) => item.station_id === reference || (item.name || '').trim().toLowerCase() === normalized || (item.code || '').trim().toLowerCase() === normalized)
  if (station) return canonicalStationName(station) || 'Station reference data requires reconciliation'
  if (isDatabaseId(reference)) return 'Station reference unavailable'
  return canonicalStationName(reference) || 'Station reference data requires reconciliation'
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

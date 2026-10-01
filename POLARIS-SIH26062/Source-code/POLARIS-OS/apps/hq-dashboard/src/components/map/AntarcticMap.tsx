import { useCallback, useEffect, useMemo, useState } from 'react'
import proj4 from 'proj4'
import antarcticaSource from '../../data/antarctica.geojson?raw'
import { apiGet } from '../../services/api'
import type { Incident, Station, TransportLeg } from '../../types'
import { formatDateTime, isSupportedIndianStation, recordLabel } from '../../utils/display'

type Point = { latitude: number; longitude: number }
type CoordinateValue = Point | { latitude?: number | null; longitude?: number | null; coordinates?: number[] | null } | number[] | string | null | undefined
type Vessel = { mmsi: string; ship_name?: string | null; latitude: number; longitude: number; speed_over_ground?: number | null; course_over_ground?: number | null; true_heading?: number | null; received_at: string; source: string; status: 'live' | 'recent' | 'stale' }
type AisStatus = { state: string; configured: boolean; last_message_at?: string | null; last_error?: string | null }
type LandFeatureCollection = { features: Array<{ geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } }> }
const antarctica = JSON.parse(antarcticaSource.replace(/^\uFEFF/, '')) as LandFeatureCollection

const STATIC_REFERENCE: Record<'Maitri' | 'Bharati', Point> = {
  Maitri: { latitude: -70.7668, longitude: 11.7342 },
  Bharati: { latitude: -69.4068, longitude: 76.1953 },
}

proj4.defs('EPSG:3031', '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs')
const outerRadiusMeters = Math.hypot(...proj4('EPSG:4326', 'EPSG:3031', [0, -55]))
function project(point: Point) {
  const [easting, northing] = proj4('EPSG:4326', 'EPSG:3031', [point.longitude, point.latitude])
  const scale = 43 / outerRadiusMeters
  return { x: 50 + easting * scale, y: 50 - northing * scale }
}

function parsePoint(value: CoordinateValue): Point | null {
  if (!value) return null
  let longitude: number | undefined
  let latitude: number | undefined
  if (Array.isArray(value) && value.length >= 2) [longitude, latitude] = value
  else if (typeof value === 'object') {
    const point = value as { latitude?: number | null; longitude?: number | null; coordinates?: number[] | null }
    if (typeof point.latitude === 'number' && typeof point.longitude === 'number') ({ latitude, longitude } = point)
    else if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) [longitude, latitude] = point.coordinates
  } else if (typeof value === 'string') {
    const match = value.trim().match(/(?:SRID=\d+;)?POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i) || value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/)
    if (match) { longitude = Number(match[1]); latitude = Number(match[2]) }
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > -50 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

function stationPoint(station: Station): Point | null { return parsePoint(station.location) || parsePoint(station.coordinates) }

function landPaths() {
  return antarctica.features.flatMap((feature, featureIndex) => {
    const polygons: number[][][][] = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as number[][][]]
      : feature.geometry.coordinates as number[][][][]
    return polygons.flatMap((polygon, polygonIndex) => polygon.map((ring, ringIndex) => {
      const path = ring.map(([longitude, latitude], index) => {
        const p = project({ latitude, longitude })
        return `${index === 0 ? 'M' : 'L'}${p.x.toFixed(3)},${p.y.toFixed(3)}`
      }).join(' ')
      return { key: `${featureIndex}:${polygonIndex}:${ringIndex}`, path: `${path} Z` }
    }))
  })
}

type Props = { stations: Station[]; transportLegs: TransportLeg[]; incidents: Incident[] }
export function AntarcticMap({ stations, transportLegs, incidents }: Props) {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [aisStatus, setAisStatus] = useState<AisStatus | null>(null)
  const [vesselError, setVesselError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedMmsi, setSelectedMmsi] = useState('')
  const [selectedTrack, setSelectedTrack] = useState<Vessel[]>([])
  const [selectedDetails, setSelectedDetails] = useState<Vessel | null>(null)
  const supported = stations.filter(isSupportedIndianStation)
  const unsupportedCount = stations.length - supported.length
  const land = useMemo(landPaths, [])

  const refreshVessels = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (filter !== 'all') params.set('status', filter)
      const [rows, status] = await Promise.all([
        apiGet<Vessel[]>(`/vessels${params.size ? `?${params.toString()}` : ''}`),
        apiGet<AisStatus>('/vessels/status'),
      ])
      setVessels(Array.isArray(rows) ? rows : [])
      setAisStatus(status)
      setVesselError('')
    } catch (cause) {
      setVesselError(cause instanceof Error ? cause.message : 'Vessel feed is unavailable.')
    }
  }, [search, filter])

  useEffect(() => {
    void refreshVessels()
    const timer = window.setInterval(() => void refreshVessels(), 30_000)
    const visible = () => { if (document.visibilityState === 'visible') void refreshVessels() }
    document.addEventListener('visibilitychange', visible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [refreshVessels])

  useEffect(() => {
    if (!selectedMmsi) { setSelectedDetails(null); setSelectedTrack([]); return }
    let active = true
    void Promise.all([
      apiGet<Vessel>(`/vessels/${selectedMmsi}`),
      apiGet<Vessel[]>(`/vessels/track/${selectedMmsi}?limit=100`),
    ]).then(([details, track]) => {
      if (active) { setSelectedDetails(details); setSelectedTrack(Array.isArray(track) ? track : []) }
    }).catch((cause) => { if (active) setVesselError(cause instanceof Error ? cause.message : 'Vessel detail is unavailable.') })
    return () => { active = false }
  }, [selectedMmsi])

  const stationMarkers = supported.map((station) => {
    const name: 'Maitri' | 'Bharati' = ((station.name || '').toLowerCase() === 'bharati' || (station.code || '').toLowerCase() === 'bharati') ? 'Bharati' : 'Maitri'
    const apiPoint = stationPoint(station)
    return { key: station.station_id, name, point: apiPoint || STATIC_REFERENCE[name], provenance: apiPoint ? 'API' : 'Static reference' }
  })
  const routeLines = useMemo(() => transportLegs.flatMap((leg) => {
    const start = parsePoint(leg.origin_point)
    const end = parsePoint(leg.destination_point)
    if (!start || !end) return []
    return [{ key: leg.leg_id, label: recordLabel(leg.code, leg.leg_id, 'Unresolved route'), start: project(start), end: project(end) }]
  }), [transportLegs])
  const incidentMarkers = incidents.flatMap((incident) => {
    const point = parsePoint(incident.location)
    return point ? [{ key: incident.incident_id, name: incident.type || 'Incident', point: project(point) }] : []
  })
  const visibleTrack = [...selectedTrack].reverse().map((fix) => project({ latitude: fix.latitude, longitude: fix.longitude }))
  const operationalCoordinatesAvailable = stationMarkers.some((marker) => marker.provenance === 'API') || routeLines.length > 0 || incidentMarkers.length > 0
  const unsupportedStations = stations.filter((station) => !isSupportedIndianStation(station))
  const latitudeRings = [-60, -66.56, -70, -80].map((latitude) => {
    const p = project({ latitude, longitude: 0 })
    return { latitude, radius: Math.hypot(p.x - 50, p.y - 50) }
  })

  return <div className="geo-context">
    <div className="map-surface" role="img" aria-label="Antarctic operational map in WGS 84 Antarctic Polar Stereographic EPSG 3031 with API-backed stations, routes, incidents, and received AIS vessel positions.">
      <svg className="map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <title>Antarctic operational map · EPSG:3031</title>
        <defs><clipPath id="antarctic-polar-clip"><circle cx="50" cy="50" r="42.8" /></clipPath></defs>
        <circle className="antarctic-map-boundary" cx="50" cy="50" r="43" />
        <g clipPath="url(#antarctic-polar-clip)">
        {land.map(({ key, path }) => <path key={key} className="antarctica-land" d={path} />)}
        {latitudeRings.map((ring) => <g key={ring.latitude}><circle className="map-graticule" cx="50" cy="50" r={ring.radius} /><text className="map-grid-label" x="51" y={50 - ring.radius + 2}>{ring.latitude}°S</text></g>)}
        {Array.from({ length: 12 }, (_, index) => { const angle = (index * 30 * Math.PI) / 180; return <line key={index} className="map-graticule" x1="50" y1="50" x2={50 + 43 * Math.sin(angle)} y2={50 - 43 * Math.cos(angle)} /> })}
        <circle className="south-pole-marker" cx="50" cy="50" r="1.3" /><text className="map-grid-label" x="52" y="52">South Pole</text>
        {routeLines.map((line) => <g key={line.key}><line className="map-route" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} /><text className="map-route-label" x={(line.start.x + line.end.x) / 2} y={(line.start.y + line.end.y) / 2 - 1}>{line.label}</text></g>)}
        {incidentMarkers.map((marker) => <g key={marker.key} className="map-incident-marker"><circle cx={marker.point.x} cy={marker.point.y} r="1.5" /><text className="map-incident-label" x={marker.point.x + 2} y={marker.point.y - 1}>{marker.name}</text></g>)}
        {stationMarkers.map((marker) => { const point = project(marker.point); return <g key={marker.key} className="map-station-marker"><circle cx={point.x} cy={point.y} r="2" /><text className="map-station-label" x={point.x + 2} y={point.y - 2}>{marker.name}</text></g> })}
        {visibleTrack.length > 1 && <polyline className="vessel-track" points={visibleTrack.map((p) => `${p.x},${p.y}`).join(' ')} />}
        {vessels.map((vessel) => { const point = project(vessel); return <g key={vessel.mmsi} className={`vessel-marker vessel-marker--${vessel.status}`} onClick={() => setSelectedMmsi(vessel.mmsi)}><title>{`${vessel.ship_name || 'Unknown vessel'} · MMSI ${vessel.mmsi} · ${vessel.status}`}</title><circle cx={point.x} cy={point.y} r={selectedMmsi === vessel.mmsi ? 2.3 : 1.7} /></g> })}
        </g>
      </svg>
      <div className="map-scale-label">EPSG:3031 · WGS 84 Antarctic Polar Stereographic · 55°S extent</div>
    </div>
    <div className="geo-map-meta">
      <p className="data-note">Coastline: Natural Earth 1:50m country polygon. Operational overlays are from the API. Static station references are identified as such.</p>
      {!operationalCoordinatesAvailable && <div className="overlay-status" role="status"><div><strong>OPERATIONAL OVERLAYS</strong><span>Unavailable</span></div><button type="button" className="btn-secondary-sm" onClick={() => window.dispatchEvent(new Event('polaris:refresh'))}>Retry</button></div>}
      {unsupportedCount > 0 && <details className="quality-notice"><summary>Data quality · {unsupportedCount} station record(s) need review</summary><ul>{unsupportedStations.map((station) => <li key={station.station_id}>{recordLabel(station.name, station.code || station.station_id, 'Unnamed station')} <span className="station-quality-badge">DEMO / UNMAPPED</span></li>)}</ul></details>}
      <div className="map-station-list">{stationMarkers.map((station) => <div key={station.key}><strong>{station.name}</strong><span>{station.provenance === 'API' ? 'API coordinates' : 'Static station location'}</span><small>{Math.abs(station.point.latitude).toFixed(4)}°S, {station.point.longitude.toFixed(4)}°E</small></div>)}</div>
      <section className="vessel-panel" aria-label="AIS vessel traffic">
        <div className="panel-header"><div><p className="eyebrow">AIS VESSEL TRAFFIC</p><h3>{vessels.length ? `LIVE · ${vessels.length} vessels` : 'AIS vessel traffic'}</h3><p className="data-note">Status: <span className={`vessel-state ${aisStatus?.configured ? '' : 'vessel-state--stale'}`}>{aisStatus?.configured ? 'LIVE' : vesselError ? 'UNAVAILABLE' : aisStatus ? 'NOT CONFIGURED' : 'CHECKING'}</span>{aisStatus?.last_message_at ? ` · Last update ${formatDateTime(aisStatus.last_message_at, true)}` : ''}</p></div><button type="button" className="btn-secondary-sm" onClick={() => void refreshVessels()}>Refresh</button></div>
        {vesselError && <div className="map-data-warning" role="status"><strong>AIS DATA UNAVAILABLE</strong><span>Live vessel traffic could not be loaded.</span><details><summary>Technical details</summary>{vesselError}</details></div>}
        {aisStatus && !aisStatus.configured && <p className="map-data-warning" role="status">Live AIS traffic is unavailable because the AIS provider has not been configured.</p>}
        {aisStatus?.configured && <div className="toolbar-group"><label>Search vessels <input className="text-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ship name or MMSI" /></label><label>Feed age <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All</option><option value="live">Live (≤2 min)</option><option value="recent">Recent (2–30 min)</option><option value="stale">Stale (&gt;30 min)</option></select></label></div>}
        {vessels.length > 0 && <div className="table-scroll"><table><thead><tr><th>Vessel / MMSI</th><th>Position</th><th>Speed / course</th><th>Received</th><th>Status</th></tr></thead><tbody>{vessels.map((vessel) => <tr key={vessel.mmsi} className="vessel-row" onClick={() => setSelectedMmsi(vessel.mmsi)}><td>{recordLabel(vessel.ship_name, vessel.mmsi)}<small className="table-subtext">MMSI {vessel.mmsi}</small></td><td>{Math.abs(vessel.latitude).toFixed(3)}°S · {vessel.longitude.toFixed(3)}°</td><td>{vessel.speed_over_ground ?? '—'} kn · {vessel.course_over_ground ?? '—'}°</td><td>{formatDateTime(vessel.received_at, true)}</td><td><span className={`vessel-state vessel-state--${vessel.status}`}>{vessel.status}</span></td></tr>)}</tbody></table></div>}
        {selectedDetails && <div className="vessel-detail"><h4>{selectedDetails.ship_name || 'Unknown vessel'} · MMSI {selectedDetails.mmsi}</h4><p>Position {selectedDetails.latitude.toFixed(4)}, {selectedDetails.longitude.toFixed(4)} · heading {selectedDetails.true_heading ?? 'not reported'}° · source {selectedDetails.source}</p><p>{selectedTrack.length} received track points. No interpolation is performed between AIS reports.</p></div>}
        {!vesselError && aisStatus?.configured && vessels.length === 0 && <p className="data-note">No AIS vessel positions have been received for Antarctica yet.</p>}
      </section>
      {routeLines.length === 0 && <p className="data-note">No transport routes with valid API endpoint coordinates.</p>}
      {incidentMarkers.length === 0 && incidents.length > 0 && <p className="data-note">Incident coordinates are unavailable from API.</p>}
      {!stationMarkers.length && <p className="data-note">No supported Maitri/Bharati station records returned by API.</p>}
    </div>
  </div>
}

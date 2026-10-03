import { Fragment, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet'
import { apiGet } from '../../services/api'
import type { CargoItem, Expedition, Incident, Personnel, PersonnelAssignment, Station, TransportLeg, TransportResource } from '../../types'
import { canonicalStationName, formatDateTime, recordLabel } from '../../utils/display'
import { demoOperationsStore, mockTrackingService } from '../../services/operations-demo'
import { demoOperations } from '../../mock-data/operations'
import { NETWORK_REFERENCES, POLAR_STATION_REFERENCES } from '../../data/polar-stations'

type Point = { latitude: number; longitude: number }
type CoordinateValue = Point | { latitude?: number | null; longitude?: number | null; coordinates?: number[] | null } | number[] | string | null | undefined
type Vessel = { mmsi: string; ship_name?: string | null; latitude: number; longitude: number; speed_over_ground?: number | null; course_over_ground?: number | null; true_heading?: number | null; received_at: string; source: string; status: 'live' | 'recent' | 'stale' }
type AisStatus = { state: string; configured: boolean; last_message_at?: string | null }
type ViewCommand = { id: number; mode?: 'GLOBAL_NETWORK' | 'ANTARCTIC_FOCUS'; point?: Point; bounds?: LatLngBoundsExpression; zoom?: number; follow?: boolean; zoomOnly?: boolean }
type Props = { stations: Station[]; transportLegs: TransportLeg[]; incidents: Incident[]; expeditions?: Expedition[]; cargoItems?: CargoItem[]; resources?: TransportResource[]; personnel?: Personnel[]; assignments?: PersonnelAssignment[]; onNavigate: (route: string) => void }

const OSM_TILE_URL = import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
const REF: Record<string, Point> = {
  India: NETWORK_REFERENCES.india,
  'NCPOR / Central Operations': POLAR_STATION_REFERENCES.ncpor.point,
  'Cape Town': NETWORK_REFERENCES.capeTown,
  Maitri: POLAR_STATION_REFERENCES.maitri.point,
  Bharati: POLAR_STATION_REFERENCES.bharati.point,
  Himadri: POLAR_STATION_REFERENCES.himadri.point,
}

function parsePoint(value: CoordinateValue): Point | null {
  if (!value) return null
  let latitude: number | undefined
  let longitude: number | undefined
  if (Array.isArray(value) && value.length >= 2) [longitude, latitude] = value
  else if (typeof value === 'object' && !Array.isArray(value)) {
    const coordinate = value as { latitude?: number | null; longitude?: number | null; coordinates?: number[] | null }
    if (typeof coordinate.latitude === 'number' && typeof coordinate.longitude === 'number') ({ latitude, longitude } = coordinate as Point)
    else if (Array.isArray(coordinate.coordinates) && coordinate.coordinates.length >= 2) [longitude, latitude] = coordinate.coordinates
  } else if (typeof value === 'string') {
    const match = value.trim().match(/(?:SRID=\d+;)?POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i) || value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/)
    if (match) { longitude = Number(match[1]); latitude = Number(match[2]) }
  }
  return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null
}

function icon(kind: 'ship' | 'aircraft' | 'station' | 'incident', selected = false, heading = 0) {
  const symbols = { ship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14.2 5.1 9h13.8l2.1 5.2-9 5.1-9-5.1Zm5-7.4h8v2H8zM11 3h2v3.8h-2z" fill="currentColor" stroke="#f7fafc" stroke-width=".7"/></svg>', aircraft: '✈', station: '●', incident: '!' }
  return L.divIcon({ className: `polaris-leaflet-marker polaris-${kind}${selected ? ' is-selected' : ''}`, html: `<span style="--heading:${heading}deg">${symbols[kind]}</span>`, iconSize: kind === 'station' ? [18, 18] : [30, 30], iconAnchor: kind === 'station' ? [9, 9] : [15, 15] })
}

function demoRouteSegments(route: Array<{ lat: number; lon: number }>, progress: number) {
  if (route.length < 2 || progress <= 0) return { completed: [] as [number, number][], planned: route.map((point) => [point.lat, point.lon] as [number, number]) }
  const scaled = Math.min(1, progress) * (route.length - 1)
  const segment = Math.min(Math.floor(scaled), route.length - 2)
  const t = scaled - segment
  const a = route[segment]; const b = route[segment + 1]
  const current: [number, number] = [a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t]
  return { completed: [...route.slice(0, segment + 1).map((point) => [point.lat, point.lon] as [number, number]), current], planned: [current, ...route.slice(segment + 1).map((point) => [point.lat, point.lon] as [number, number])] }
}

function MapCamera({ command }: { command: ViewCommand }) {
  const map = useMap()
  useEffect(() => {
    if (command.zoomOnly && command.zoom) map.flyTo(map.getCenter(), command.zoom, { duration: 0.45 })
    else if (command.bounds) map.flyToBounds(command.bounds, { padding: [52, 52], maxZoom: command.zoom ?? 4, duration: 1.15 })
    else if (command.point) map.flyTo([command.point.latitude, command.point.longitude], command.zoom ?? Math.max(map.getZoom(), 5), { duration: 1.1 })
    else if (command.mode === 'ANTARCTIC_FOCUS') map.flyToBounds([[-78, -5], [-61, 95]], { padding: [40, 40], maxZoom: 4, duration: 1.15 })
    else if (command.mode === 'GLOBAL_NETWORK') map.flyToBounds([[-75, 8], [24, 86]], { padding: [44, 54], maxZoom: 3, duration: 1.15 })
  }, [command, map])
  return null
}

export function AntarcticMap({ stations, transportLegs, incidents, expeditions = [], cargoItems = [], resources = [], personnel = [], assignments = [], onNavigate }: Props) {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [aisStatus, setAisStatus] = useState<AisStatus | null>(null)
  const [aisError, setAisError] = useState('')
  const [mapMode, setMapMode] = useState<'GLOBAL_NETWORK' | 'ANTARCTIC_FOCUS'>('GLOBAL_NETWORK')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selectedDemoId, setSelectedDemoId] = useState('')
  const [selectedMmsi, setSelectedMmsi] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [selectedStation, setSelectedStation] = useState('')
  const [selectedIncident, setSelectedIncident] = useState('')
  const [selectedReference, setSelectedReference] = useState('')
  const [following, setFollowing] = useState(false)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showWaypoints, setShowWaypoints] = useState(true)
  const [showStations, setShowStations] = useState(true)
  const [showAssets, setShowAssets] = useState(true)
  const [showIncidents, setShowIncidents] = useState(true)
  const [showCargo, setShowCargo] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [fullScreen, setFullScreen] = useState(false)
  const [tab, setTab] = useState<'DETAILS' | 'VOYAGE' | 'HISTORY'>('DETAILS')
  const [focusPoint, setFocusPoint] = useState<Point | undefined>()
  const [camera, setCamera] = useState<ViewCommand>({ id: 0, mode: 'GLOBAL_NETWORK' })
  const [vesselDetails, setVesselDetails] = useState<Vessel | null>(null)
  const [vesselTrack, setVesselTrack] = useState<Vessel[]>([])
  const demoState = useSyncExternalStore(demoOperationsStore.subscribe, demoOperationsStore.getState, demoOperationsStore.getState)
  const demoAssets = demoState.assets
  const selectedDemo = demoAssets.find((asset) => asset.id === selectedDemoId)
  const selectedVessel = vessels.find((vessel) => vessel.mmsi === selectedMmsi) || vesselDetails
  const selectedDemoIncident = demoState.incidents.find((incident) => incident.id === selectedIncident)

  const issueCamera = useCallback((next: Omit<ViewCommand, 'id'>) => setCamera((current) => ({ ...next, id: current.id + 1 })), [])
  const fitNetwork = useCallback(() => {
    const points = [REF.India, REF['Cape Town'], REF.Maitri, REF.Bharati,
      ...demoAssets.map((asset) => ({ latitude: asset.position.lat, longitude: asset.position.lon })),
      ...vessels.map((vessel) => ({ latitude: vessel.latitude, longitude: vessel.longitude })),
      ...transportLegs.flatMap((leg) => [parsePoint(leg.origin_point), parsePoint(leg.destination_point)].filter((point): point is Point => !!point)),
    ]
    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]))
    setMapMode('GLOBAL_NETWORK')
    issueCamera({ bounds: bounds as LatLngBoundsExpression, zoom: 3 })
  }, [demoAssets, issueCamera, transportLegs, vessels])

  useEffect(() => {
    const stop = mockTrackingService.simulate()
    return () => stop()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void Promise.all([apiGet<Vessel[]>('/vessels'), apiGet<AisStatus>('/vessels/status')]).then(([rows, status]) => {
        setVessels(Array.isArray(rows) ? rows : [])
        setAisStatus(status)
        setAisError('')
      }).catch((error: unknown) => setAisError(error instanceof Error ? error.message : 'AIS provider status unavailable.'))
    }, 30_000)
    void Promise.all([apiGet<Vessel[]>('/vessels'), apiGet<AisStatus>('/vessels/status')]).then(([rows, status]) => {
      setVessels(Array.isArray(rows) ? rows : [])
      setAisStatus(status)
      setAisError('')
    }).catch((error: unknown) => setAisError(error instanceof Error ? error.message : 'AIS provider status unavailable.'))
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedMmsi) { setVesselDetails(null); setVesselTrack([]); return }
    let active = true
    void Promise.all([apiGet<Vessel>(`/vessels/${selectedMmsi}`), apiGet<Vessel[]>(`/vessels/track/${selectedMmsi}?limit=100`)]).then(([details, track]) => {
      if (active) { setVesselDetails(details); setVesselTrack(Array.isArray(track) ? track : []) }
    }).catch(() => { if (active) setVesselDetails(null) })
    return () => { active = false }
  }, [selectedMmsi])

  useEffect(() => {
    if (!following || !selectedDemo) return
    issueCamera({ point: { latitude: selectedDemo.position.lat, longitude: selectedDemo.position.lon }, zoom: 5, follow: true })
  }, [following, selectedDemo?.position.lat, selectedDemo?.position.lon, selectedDemo, issueCamera])
  useEffect(() => {
    if (!following || !selectedVessel) return
    issueCamera({ point: { latitude: selectedVessel.latitude, longitude: selectedVessel.longitude }, zoom: 6, follow: true })
  }, [following, selectedVessel?.latitude, selectedVessel?.longitude, selectedVessel, issueCamera])

  const apiRoutes = transportLegs.flatMap((leg) => {
    const start = parsePoint(leg.origin_point)
    const end = parsePoint(leg.destination_point)
    if (!start || !end) return []
    const middle = (leg.waypoints || []).map((waypoint) => parsePoint(waypoint.location) || (typeof waypoint.latitude === 'number' && typeof waypoint.longitude === 'number' ? { latitude: waypoint.latitude, longitude: waypoint.longitude } : null)).filter((point): point is Point => !!point)
    return [{ id: leg.leg_id, leg, points: [start, ...middle, end] }]
  })

  const referenceStations = [
    { name: 'NCPOR / Central Operations', region: 'Goa, India', point: REF['NCPOR / Central Operations'], description: 'HQ / Central Operations' },
    { name: 'Maitri', region: 'Antarctica', point: REF.Maitri, description: 'Indian Antarctic Station' },
    { name: 'Bharati', region: 'Antarctica', point: REF.Bharati, description: 'Indian Antarctic Station' },
    { name: 'Himadri', region: 'Svalbard, Arctic', point: REF.Himadri, description: 'Indian Arctic Station' },
  ]
  const stationMarkers = stations.flatMap((station) => {
    const canonical = canonicalStationName(station)
    const reference = referenceStations.find((item) => item.name.startsWith(canonical || '\0'))
    const point = parsePoint(station.location) || parsePoint(station.coordinates) || reference?.point
    return point ? [{ id: station.station_id, name: reference?.name || 'Synthetic station reference', point, source: parsePoint(station.location) || parsePoint(station.coordinates) ? 'API' : 'DEMO / SIMULATED', description: reference?.description || 'Demo station data', region: reference?.region || 'Region unavailable' }] : []
  })
  const knownStationMarkers = referenceStations.filter((station) => !stationMarkers.some((marker) => marker.name === station.name)).map((station) => ({ ...station, id: `REF-${station.name}`, source: 'DEMO / SIMULATED' as const }))

  const clearSelection = () => { setSelectedDemoId(''); setSelectedMmsi(''); setSelectedRouteId(''); setSelectedStation(''); setSelectedIncident(''); setSelectedReference(''); setFollowing(false); setFocusPoint(undefined) }
  const selectAsset = (id: string) => {
    const asset = demoAssets.find((item) => item.id === id)
    if (!asset) return
    clearSelection(); setSelectedDemoId(id); setFocusPoint({ latitude: asset.position.lat, longitude: asset.position.lon }); issueCamera({ point: { latitude: asset.position.lat, longitude: asset.position.lon }, zoom: 5 })
  }
  const selectVessel = (vessel: Vessel) => {
    const linked = apiRoutes.find(({ leg }) => leg.transport_resource_id === resources.find((resource) => resource.registration_code?.toLowerCase() === vessel.mmsi.toLowerCase() || resource.name.toLowerCase() === (vessel.ship_name || '').toLowerCase())?.resource_id)
    clearSelection(); setSelectedMmsi(vessel.mmsi); setSelectedRouteId(linked?.id || ''); setFocusPoint({ latitude: vessel.latitude, longitude: vessel.longitude }); issueCamera({ point: { latitude: vessel.latitude, longitude: vessel.longitude }, zoom: 5 })
  }
  const selectRoute = (id: string) => {
    const demo = demoAssets.find((asset) => asset.id === id)
    const api = apiRoutes.find((route) => route.id === id)
    clearSelection(); setSelectedRouteId(id)
    const points = demo ? demo.route.map((point) => [point.lat, point.lon] as [number, number]) : api?.points.map((point) => [point.latitude, point.longitude] as [number, number])
    if (points?.length) issueCamera({ bounds: L.latLngBounds(points) as unknown as LatLngBoundsExpression, zoom: 4 })
  }

  const query = search.trim().toLowerCase()
  const visibleDemoAssets = demoAssets.filter((asset) => {
    const typeOk = entityFilter === 'ALL' || (entityFilter === 'SHIPS' && asset.kind === 'ship') || (entityFilter === 'FLIGHTS' && asset.kind === 'flight') || (entityFilter === 'CARGO' && asset.cargoIds.length > 0) || entityFilter === 'OPERATIONS'
    const sourceOk = sourceFilter === 'ALL' || sourceFilter === 'DEMO'
    const statusOk = statusFilter === 'ALL' || asset.status.replaceAll('_', ' ') === statusFilter
    const text = `${asset.id} ${asset.name} ${asset.registration} ${asset.destination} ${asset.operationId} ${asset.cargoIds.join(' ')}`.toLowerCase()
    return typeOk && sourceOk && statusOk && (!query || text.includes(query))
  }).filter((asset) => !vessels.some((vessel) => !!asset.mmsi && vessel.mmsi === asset.mmsi))
  const visibleVessels = vessels.filter((vessel) => (entityFilter === 'ALL' || entityFilter === 'SHIPS') && (sourceFilter === 'ALL' || sourceFilter === 'API' || sourceFilter === 'LIVE' && vessel.status === 'live') && (statusFilter === 'ALL' || statusFilter.toLowerCase() === vessel.status) && (!query || `${vessel.ship_name || ''} ${vessel.mmsi}`.toLowerCase().includes(query)))
  const aisState = aisError ? 'UNAVAILABLE' : !aisStatus ? 'CHECKING' : aisStatus.configured ? (vessels.some((vessel) => vessel.status === 'live') ? 'LIVE' : 'AWAITING DATA') : 'NOT CONFIGURED'
  const selectedLeg = apiRoutes.find((route) => route.id === selectedRouteId)?.leg
  const selectedRouteDemo = demoAssets.find((asset) => asset.id === selectedRouteId)
  const selectedRouteResource = selectedLeg && resources.find((resource) => resource.resource_id === selectedLeg.transport_resource_id)
  const selectedRouteExpedition = selectedLeg && expeditions.find((expedition) => expedition.expedition_id === selectedLeg.expedition_id)
  const selectedRouteCargo = selectedLeg ? cargoItems.filter((cargo) => cargo.leg_id === selectedLeg.leg_id) : []
  const selectedApiIncident = incidents.find((incident) => incident.incident_id === selectedIncident)
  const selectedApiStation = stations.find((station) => station.station_id === selectedStation)
  const stationLegs = selectedApiStation ? transportLegs.filter((leg) => [selectedApiStation.station_id, selectedApiStation.code, selectedApiStation.name].includes(leg.origin || '') || [selectedApiStation.station_id, selectedApiStation.code, selectedApiStation.name].includes(leg.destination || '')) : []
  const stationLegIds = new Set(stationLegs.map((leg) => leg.leg_id))
  const stationCargo = cargoItems.filter((cargo) => !!cargo.leg_id && stationLegIds.has(cargo.leg_id))
  const stationOperationIds = new Set([...stationLegs.map((leg) => leg.expedition_id), ...assignments.filter((assignment) => assignment.station_id === selectedStation).map((assignment) => assignment.expedition_id)].filter((id): id is string => !!id))
  const stationOperations = expeditions.filter((expedition) => stationOperationIds.has(expedition.expedition_id))
  const stationPersonnel = personnel.filter((person) => person.assigned_station_id === selectedStation)
  const stationIncidents = incidents.filter((incident) => incident.station_id === selectedStation || (!!incident.leg_id && stationLegIds.has(incident.leg_id)))
  const selectedVesselResource = selectedVessel && resources.find((resource) => resource.registration_code?.toLowerCase() === selectedVessel.mmsi.toLowerCase() || resource.name.toLowerCase() === (selectedVessel.ship_name || '').toLowerCase())
  const selectedVesselLeg = selectedVesselResource && transportLegs.find((leg) => leg.transport_resource_id === selectedVesselResource.resource_id)
  const selectedVesselExpedition = selectedVesselLeg && expeditions.find((expedition) => expedition.expedition_id === selectedVesselLeg.expedition_id)
  const selectedVesselCargo = selectedVesselLeg ? cargoItems.filter((cargo) => cargo.leg_id === selectedVesselLeg.leg_id) : []
  const globalBounds: LatLngBoundsExpression = [[-75, 8], [24, 86]]

  const searchResults = query ? [
    ...demoAssets.filter((asset) => `${asset.id} ${asset.name} ${asset.registration} ${asset.operationId}`.toLowerCase().includes(query)).map((asset) => ({ label: asset.id, type: asset.kind === 'ship' ? 'SHIP' : 'AIRCRAFT', source: 'DEMO / SIMULATED', action: () => selectAsset(asset.id) })),
    ...vessels.filter((vessel) => `${vessel.ship_name || ''} ${vessel.mmsi}`.toLowerCase().includes(query)).map((vessel) => ({ label: vessel.ship_name || vessel.mmsi, type: 'SHIP', source: vessel.status === 'live' ? 'LIVE AIS' : 'API', action: () => selectVessel(vessel) })),
    ...stations.filter((station) => `${station.name} ${station.code}`.toLowerCase().includes(query)).map((station) => ({ label: canonicalStationName(station) || station.name || 'Synthetic station reference', type: 'STATION', source: 'API', action: () => { const name = canonicalStationName(station); const point = parsePoint(station.location) || parsePoint(station.coordinates) || referenceStations.find((item) => item.name.startsWith(name || '\0'))?.point; clearSelection(); setSelectedStation(station.station_id); setSelectedReference(name || 'Synthetic station reference'); if (point) { setFocusPoint(point); issueCamera({ point, zoom: 5 }) } } })),
    ...referenceStations.filter((station) => station.name.toLowerCase().includes(query)).map((station) => ({ label: station.name, type: 'STATION', source: 'DEMO / SIMULATED REFERENCE', action: () => { clearSelection(); setSelectedReference(station.name); issueCamera({ point: station.point, zoom: 4 }) } })),
    ...demoOperations.filter((operation) => `${operation.id} ${operation.name}`.toLowerCase().includes(query)).map((operation) => ({ label: `${operation.id} · ${operation.name}`, type: 'OPERATION', source: 'DEMO', action: () => { const asset = demoAssets.find((item) => item.operationId === operation.id); if (asset) selectAsset(asset.id); else onNavigate('demo-operations') } })),
    ...expeditions.filter((expedition) => `${expedition.code || ''} ${expedition.name || ''} ${expedition.expedition_id}`.toLowerCase().includes(query)).map((expedition) => ({ label: `${expedition.code || expedition.expedition_id} · ${expedition.name || 'Expedition'}`, type: 'EXPEDITION', source: 'API', action: () => { const leg = apiRoutes.find((route) => route.leg.expedition_id === expedition.expedition_id); if (leg) selectRoute(leg.id); else { sessionStorage.setItem('polaris_expedition_focus', expedition.expedition_id); onNavigate('expeditions') } } })),
    ...apiRoutes.filter(({ leg }) => `${leg.code || ''} ${leg.leg_id} ${leg.origin || ''} ${leg.destination || ''}`.toLowerCase().includes(query)).map(({ id, leg }) => ({ label: leg.code || recordLabel(null, id, 'Transport leg'), type: 'ROUTE', source: 'API', action: () => selectRoute(id) })),
    ...incidents.filter((incident) => `${incident.incident_id} ${incident.type || ''}`.toLowerCase().includes(query)).map((incident) => ({ label: incident.incident_id, type: 'INCIDENT', source: 'API', action: () => { clearSelection(); setSelectedIncident(incident.incident_id); const point = parsePoint(incident.location); if (point) issueCamera({ point, zoom: 6 }) } })),
    ...cargoItems.filter((cargo) => `${cargo.tracking_code || ''} ${cargo.cargo_id} ${cargo.description || ''}`.toLowerCase().includes(query)).map((cargo) => ({ label: cargo.tracking_code || cargo.cargo_id, type: 'CARGO', source: 'API', action: () => cargo.leg_id ? selectRoute(cargo.leg_id) : onNavigate('cargo') })),
  ].flat().slice(0, 7) : []

  return <div className={`operational-map osm-operational-map${fullScreen ? ' is-fullscreen' : ''}`}>
    <div className="operational-map-toolbar">
      <div className="map-mode-switch" role="group" aria-label="Map mode">
        <button type="button" className={mapMode === 'GLOBAL_NETWORK' ? 'active' : ''} aria-pressed={mapMode === 'GLOBAL_NETWORK'} onClick={() => { setMapMode('GLOBAL_NETWORK'); setFollowing(false); issueCamera({ mode: 'GLOBAL_NETWORK', bounds: globalBounds, zoom: 3 }) }}>GLOBAL NETWORK</button>
        <button type="button" className={mapMode === 'ANTARCTIC_FOCUS' ? 'active' : ''} aria-pressed={mapMode === 'ANTARCTIC_FOCUS'} onClick={() => { setMapMode('ANTARCTIC_FOCUS'); setFollowing(false); issueCamera({ mode: 'ANTARCTIC_FOCUS' }) }}>ANTARCTIC FOCUS</button>
      </div>
      <div className="map-filter-row">{['ALL', 'SHIPS', 'FLIGHTS', 'CARGO', 'BASES', 'OPERATIONS', 'INCIDENTS'].map((item) => <button type="button" key={item} className={`map-filter ${entityFilter === item ? 'active' : ''}`} aria-pressed={entityFilter === item} onClick={() => setEntityFilter(item)}>{item}</button>)}</div>
      <div className="map-tools">
        <label>STATUS <select className="select-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>ALL</option><option>IN TRANSIT</option><option>PLANNED</option><option>ARRIVED</option><option>DELAYED</option><option>COMPLETED</option><option>LIVE</option><option>RECENT</option><option>STALE</option></select></label>
        <label>SOURCE <select className="select-input" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option>ALL</option><option>LIVE</option><option>API</option><option>DEMO</option></select></label>
        <label className="tracking-search">SEARCH <input className="text-input" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && searchResults[0]) searchResults[0].action() }} placeholder="Vessel, aircraft, operation, station..." /></label>
        {searchResults.length > 0 && <div className="map-search-results" role="listbox" aria-label="Tracking search results">{searchResults.map((result, index) => <button type="button" role="option" aria-selected="false" key={`${result.type}-${index}`} onClick={() => { result.action(); setSearch('') }}><span><strong>{result.label}</strong><small>{result.type}</small></span><em>{result.source}</em></button>)}</div>}
        <button type="button" className="btn-secondary-sm" onClick={() => { clearSelection(); setSearch(''); setEntityFilter('ALL'); setStatusFilter('ALL'); setSourceFilter('ALL'); setMapMode('GLOBAL_NETWORK'); issueCamera({ mode: 'GLOBAL_NETWORK', bounds: globalBounds, zoom: 3 }) }}>Reset</button>
      </div>
      <div className="map-control-row">
        <button type="button" onClick={() => setCamera((current) => ({ id: current.id + 1, zoom: Math.min(12, (current.zoom || 3) + 1), zoomOnly: true }))}>Zoom +</button><button type="button" onClick={() => setCamera((current) => ({ id: current.id + 1, zoom: Math.max(2, (current.zoom || 3) - 1), zoomOnly: true }))}>Zoom −</button>
        <button type="button" onClick={() => { setMapMode('GLOBAL_NETWORK'); issueCamera({ mode: 'GLOBAL_NETWORK', bounds: globalBounds, zoom: 3 }) }}>Reset view</button><button type="button" onClick={fitNetwork}>Fit operational network</button><button type="button" onClick={() => { setMapMode('ANTARCTIC_FOCUS'); issueCamera({ mode: 'ANTARCTIC_FOCUS' }) }}>Antarctic focus</button><button type="button" onClick={() => setFullScreen((value) => !value)}>{fullScreen ? 'Exit full screen' : 'Full screen'}</button>
        <button type="button" aria-pressed={showRoutes} onClick={() => setShowRoutes((value) => !value)}>Routes {showRoutes ? 'on' : 'off'}</button><button type="button" aria-pressed={showWaypoints} onClick={() => setShowWaypoints((value) => !value)}>Waypoints {showWaypoints ? 'on' : 'off'}</button><button type="button" aria-pressed={showStations} onClick={() => setShowStations((value) => !value)}>Stations {showStations ? 'on' : 'off'}</button><button type="button" aria-pressed={showAssets} onClick={() => setShowAssets((value) => !value)}>Assets {showAssets ? 'on' : 'off'}</button><button type="button" aria-pressed={showIncidents} onClick={() => setShowIncidents((value) => !value)}>Incidents {showIncidents ? 'on' : 'off'}</button><button type="button" aria-pressed={showCargo} onClick={() => setShowCargo((value) => !value)}>Cargo {showCargo ? 'on' : 'off'}</button><button type="button" aria-pressed={showHistory} onClick={() => setShowHistory((value) => !value)}>History trail {showHistory ? 'on' : 'off'}</button>
      </div>
    </div>

    <div className={`geo-context osm-map-layout${fullScreen ? ' map-fullscreen' : ''}`}>
      <section className="map-surface osm-map-surface" aria-label="POLARIS operational map">
        <MapContainer center={[-24, 49]} zoom={2} minZoom={2} maxZoom={18} scrollWheelZoom className="osm-map-canvas" zoomControl={false} attributionControl>
          <MapCamera command={camera} />
          <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />

          {mapMode === 'GLOBAL_NETWORK' && [
            { name: 'India', point: REF.India }, { name: 'Cape Town', point: REF['Cape Town'] },
          ].map((place) => <CircleMarker key={place.name} center={[place.point.latitude, place.point.longitude]} radius={5} pathOptions={{ color: '#8fd3ff', fillColor: '#0b1726', fillOpacity: 1, weight: 2 }} eventHandlers={{ click: () => { clearSelection(); setSelectedReference(place.name); issueCamera({ point: place.point, zoom: 5 }) } }}><Tooltip direction="top" offset={[0, -4]}>{place.name} · NETWORK REFERENCE</Tooltip></CircleMarker>)}

          {showRoutes && entityFilter !== 'SHIPS' && entityFilter !== 'FLIGHTS' && entityFilter !== 'BASES' && entityFilter !== 'INCIDENTS' && apiRoutes.filter(({ leg, id }) => {
            const legStatus = (leg.status || '').replaceAll('_', ' ').toUpperCase()
            const cargoStatusMatch = entityFilter !== 'CARGO' || cargoItems.some((cargo) => cargo.leg_id === id && (statusFilter === 'ALL' || (cargo.status || '').replaceAll('_', ' ').toUpperCase() === statusFilter))
            return (sourceFilter === 'ALL' || sourceFilter === 'API') && (statusFilter === 'ALL' || (entityFilter === 'CARGO' ? cargoStatusMatch : legStatus === statusFilter))
          }).map(({ id, leg, points }) => {
            const active = ['IN_TRANSIT', 'ACTIVE', 'DEPARTED'].includes((leg.status || '').toUpperCase())
            return <Polyline key={id} positions={points.map((point) => [point.latitude, point.longitude] as LatLngExpression)} pathOptions={{ color: selectedRouteId === id ? '#ffd166' : active ? '#42bd8b' : '#4c93b7', weight: selectedRouteId === id ? 5 : active ? 3 : 2, opacity: selectedRouteId === id ? 1 : 0.78, dashArray: active ? undefined : '8 8', className: selectedRouteId === id ? 'polaris-route-selected' : undefined }} eventHandlers={{ click: () => selectRoute(id) }}><Tooltip sticky>{recordLabel(leg.code, id, 'Transport route')} · API · {leg.status || 'Status unavailable'}</Tooltip></Polyline>
          })}
          {showRoutes && entityFilter !== 'BASES' && entityFilter !== 'INCIDENTS' && visibleDemoAssets.map((asset) => {
            const selected = selectedDemoId === asset.id || selectedRouteId === asset.id
            const segments = demoRouteSegments(asset.route, asset.progress)
            return <Fragment key={`route-${asset.id}`}>
              {segments.planned.length > 1 && <Polyline positions={segments.planned} pathOptions={{ color: selected ? '#d59f25' : '#7793a6', weight: selected ? 4 : 2, opacity: selected ? 0.9 : 0.7, dashArray: asset.status === 'IN TRANSIT' ? '7 8' : '4 8' }} eventHandlers={{ click: () => selectRoute(asset.id) }}><Tooltip>{asset.origin} → {asset.destination} · {asset.operationId} · DEMO / SIMULATED</Tooltip></Polyline>}
              {segments.completed.length > 1 && <Polyline positions={segments.completed} pathOptions={{ color: selected ? '#ffd166' : '#36a77d', weight: selected ? 5 : 3, opacity: 0.92 }} eventHandlers={{ click: () => selectRoute(asset.id) }}><Tooltip>Simulated movement to current position · DEMO</Tooltip></Polyline>}
            </Fragment>
          })}
          {showWaypoints && showRoutes && apiRoutes.flatMap(({ id, points }) => points.slice(1, -1).map((point, index) => <CircleMarker key={`api-waypoint-${id}-${index}`} center={[point.latitude, point.longitude]} radius={3} pathOptions={{ color: '#315c74', fillColor: '#eaf7ff', fillOpacity: 1, weight: 1 }}><Tooltip>API route waypoint</Tooltip></CircleMarker>))}
          {showWaypoints && showRoutes && visibleDemoAssets.flatMap((asset) => asset.route.slice(1, -1).map((point, index) => <CircleMarker key={`demo-waypoint-${asset.id}-${index}`} center={[point.lat, point.lon]} radius={3} pathOptions={{ color: '#8a681f', fillColor: '#ffedb2', fillOpacity: 1, weight: 1 }}><Tooltip>DEMO / SIMULATED waypoint · {asset.id}</Tooltip></CircleMarker>))}
          {showCargo && (entityFilter === 'ALL' || entityFilter === 'CARGO') && apiRoutes.flatMap(({ id, points }) => {
            const linkedCargo = cargoItems.filter((cargo) => cargo.leg_id === id)
            const center = points[Math.floor(points.length / 2)]
            return linkedCargo.map((cargo) => <CircleMarker key={`cargo-${cargo.cargo_id}`} center={[center.latitude, center.longitude]} radius={5} pathOptions={{ color: '#fff', fillColor: '#e5a83b', fillOpacity: .95, weight: 2 }} eventHandlers={{ click: () => { sessionStorage.setItem('polaris_cargo_focus', cargo.cargo_id); onNavigate('cargo') } }}><Tooltip>{cargo.tracking_code || cargo.cargo_id} · API cargo · {cargo.status || 'Status unavailable'}</Tooltip></CircleMarker>)
          })}
          {showCargo && (entityFilter === 'ALL' || entityFilter === 'CARGO') && visibleDemoAssets.flatMap((asset) => demoState.cargo.filter((cargo) => cargo.assetId === asset.id).map((cargo) => <CircleMarker key={`demo-cargo-${cargo.id}`} center={[asset.position.lat, asset.position.lon]} radius={4} pathOptions={{ color: '#fff', fillColor: '#c98926', fillOpacity: .95, weight: 2 }} eventHandlers={{ click: () => { sessionStorage.setItem('polaris_cargo_focus', cargo.id); onNavigate('demo-cargo') } }}><Tooltip>{cargo.id} · DEMO / SIMULATED cargo · {cargo.status}</Tooltip></CircleMarker>))}
          {showHistory && selectedDemo && selectedDemo.history.length > 1 && <Polyline positions={selectedDemo.history.map((point) => [point.point.lat, point.point.lon] as LatLngExpression)} pathOptions={{ color: '#f4d35e', weight: 2, opacity: 0.64, dashArray: '3 6' }} />}
          {showHistory && selectedMmsi && vesselTrack.length > 1 && <Polyline positions={vesselTrack.map((point) => [point.latitude, point.longitude] as LatLngExpression)} pathOptions={{ color: '#8fd3ff', weight: 2, opacity: 0.72 }} />}

          {showStations && (entityFilter === 'ALL' || entityFilter === 'BASES' || entityFilter === 'OPERATIONS') && [...stationMarkers, ...knownStationMarkers].filter((station) => sourceFilter === 'ALL' || sourceFilter === 'API' && station.source === 'API' || sourceFilter === 'DEMO' && station.source.startsWith('DEMO')).map((station) => <Marker key={station.id} position={[station.point.latitude, station.point.longitude]} icon={icon('station', selectedStation === station.id || selectedReference === station.name)} eventHandlers={{ click: () => { clearSelection(); setSelectedStation(station.id); setSelectedReference(station.name); setFocusPoint(station.point); issueCamera({ point: station.point, zoom: 5 }) } }}><Tooltip permanent direction="right" className="leaflet-polar-label">{station.name} · {station.source}</Tooltip></Marker>)}

          {showAssets && (entityFilter === 'ALL' || entityFilter === 'SHIPS' || entityFilter === 'FLIGHTS' || entityFilter === 'CARGO' || entityFilter === 'OPERATIONS') && visibleDemoAssets.map((asset) => <Marker key={asset.id} position={[asset.position.lat, asset.position.lon]} icon={icon(asset.kind === 'ship' ? 'ship' : 'aircraft', selectedDemoId === asset.id, asset.heading)} eventHandlers={{ click: () => selectAsset(asset.id) }}><Tooltip direction="top">{asset.id} · {asset.status} · DEMO / SIMULATED</Tooltip></Marker>)}
          {showAssets && visibleVessels.map((vessel) => <Marker key={vessel.mmsi} position={[vessel.latitude, vessel.longitude]} icon={icon('ship', selectedMmsi === vessel.mmsi, vessel.course_over_ground ?? vessel.true_heading ?? 0)} eventHandlers={{ click: () => selectVessel(vessel) }}><Tooltip>{vessel.ship_name || vessel.mmsi} · {vessel.status === 'live' ? 'LIVE AIS' : 'API'}</Tooltip></Marker>)}

          {showIncidents && (entityFilter === 'ALL' || entityFilter === 'INCIDENTS') && (sourceFilter === 'ALL' || sourceFilter === 'API') && incidents.filter((incident) => statusFilter === 'ALL' || (incident.status || '').replaceAll('_', ' ').toUpperCase() === statusFilter).flatMap((incident) => { const point = parsePoint(incident.location); return point ? [<Marker key={incident.incident_id} position={[point.latitude, point.longitude]} icon={icon('incident', selectedIncident === incident.incident_id)} eventHandlers={{ click: () => { clearSelection(); setSelectedIncident(incident.incident_id); setFocusPoint(point); issueCamera({ point, zoom: 6 }) } }}><Tooltip>{incident.incident_id} · {incident.severity || 'Severity unavailable'} · API</Tooltip></Marker>] : [] })}
          {showIncidents && (entityFilter === 'ALL' || entityFilter === 'INCIDENTS') && (sourceFilter === 'ALL' || sourceFilter === 'DEMO') && demoState.incidents.filter((incident) => statusFilter === 'ALL' || incident.status.replaceAll('_', ' ').toUpperCase() === statusFilter).map((incident) => <Marker key={incident.id} position={[incident.point.lat, incident.point.lon]} icon={icon('incident', selectedIncident === incident.id)} eventHandlers={{ click: () => { clearSelection(); setSelectedIncident(incident.id); setSelectedReference(''); setFocusPoint({ latitude: incident.point.lat, longitude: incident.point.lon }); issueCamera({ point: { latitude: incident.point.lat, longitude: incident.point.lon }, zoom: 6 }) } }}><Tooltip>{incident.id} · {incident.severity} · DEMO / LOCAL</Tooltip></Marker>)}
        </MapContainer>
        <div className="osm-map-attribution-note">Map geography: OpenStreetMap · © OpenStreetMap contributors</div>
        <div className="map-legend"><span>◆ Ship</span><span>✈ Aircraft</span><span>● Station</span><span className="legend-active">━━ Active route</span><span className="legend-planned">┄┄ Planned route</span><span>! Incident</span></div>
      </section>

      <aside className="tracking-rail" aria-label="Operational information rail">
        {selectedDemo && <section className="asset-focus selected-asset-card"><div className="focus-title-row"><div><p className="eyebrow">ASSET FOCUS · {selectedDemo.kind === 'ship' ? 'SHIP' : 'AIRCRAFT'} · DEMO / SIMULATED</p><h3>{selectedDemo.id}</h3><p className="selected-asset-name">{selectedDemo.registration}</p></div><button type="button" className="icon-button" aria-label="Close asset focus" onClick={clearSelection}>×</button></div><span className="vessel-state">{selectedDemo.status}</span>
          <div className="tracking-focus-tabs" role="tablist" aria-label="Asset information">{(['DETAILS', 'VOYAGE', 'HISTORY'] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
          {tab === 'DETAILS' && <><div className="tracking-progress"><span>ROUTE PROGRESS</span><strong>{Math.round(selectedDemo.progress * 100)}%</strong><div><i style={{ width: `${Math.round(selectedDemo.progress * 100)}%` }} /></div></div><div className="asset-data-grid"><div><small>OPERATION</small><strong>{selectedDemo.operationId}</strong></div><div><small>POSITION</small><strong>{selectedDemo.position.lat.toFixed(3)}, {selectedDemo.position.lon.toFixed(3)}</strong></div><div><small>{selectedDemo.kind === 'ship' ? 'SPEED' : 'ALTITUDE'}</small><strong>{selectedDemo.kind === 'ship' ? `${selectedDemo.speed.toFixed(1)} kn` : selectedDemo.altitude == null ? 'Unavailable' : `${selectedDemo.altitude} m`}</strong></div><div><small>COURSE</small><strong>{selectedDemo.heading}°</strong></div><div><small>DESTINATION / ETA</small><strong>{selectedDemo.destination} · {formatDateTime(selectedDemo.eta, true)}</strong></div><div><small>LAST UPDATE</small><strong>{formatDateTime(selectedDemo.lastUpdate, true)}</strong></div><div><small>CARGO</small><strong>{selectedDemo.cargoIds.join(', ') || 'Unavailable'}</strong></div></div></>}
          {tab === 'VOYAGE' && <><p className="selected-asset-route">{selectedDemo.origin} → {selectedDemo.destination}</p><div className="tracking-progress"><span>VOYAGE COMPLETION</span><strong>{Math.round(selectedDemo.progress * 100)}%</strong><div><i style={{ width: `${Math.round(selectedDemo.progress * 100)}%` }} /></div></div><div className="asset-data-grid"><div><small>ROUTE STATUS</small><strong>{selectedDemo.status}</strong></div><div><small>NEXT WAYPOINT</small><strong>{selectedDemo.nextWaypoint}</strong></div><div><small>OPERATION</small><strong>{selectedDemo.operationId}</strong></div><div><small>CARGO</small><strong>{selectedDemo.cargoIds.join(', ') || 'Unavailable'}</strong></div></div></>}
          {tab === 'HISTORY' && <div className="track-history"><strong>DEMO SIMULATION HISTORY · {selectedDemo.history.length} POSITIONS</strong>{selectedDemo.history.slice(-8).reverse().map((point, index) => <span key={`${point.at}-${index}`}>{formatDateTime(point.at, true)} · {point.point.lat.toFixed(3)}, {point.point.lon.toFixed(3)}</span>)}</div>}
          <div className="btn-group"><button type="button" className="btn-primary-sm" onClick={() => { const next = !following; setFollowing(next); if (next) issueCamera({ point: { latitude: selectedDemo.position.lat, longitude: selectedDemo.position.lon }, zoom: 5, follow: true }) }}>{following ? 'STOP TRACKING' : 'TRACK / FOLLOW'}</button><button type="button" className="btn-secondary-sm" onClick={() => setTab('HISTORY')}>LOG · DEMO</button><button type="button" className="btn-secondary-sm" onClick={() => { sessionStorage.setItem('polaris_operation_focus', selectedDemo.operationId); onNavigate('demo-operations') }}>VIEW OPERATION</button><button type="button" className="btn-secondary-sm" onClick={() => { sessionStorage.setItem('polaris_cargo_focus', selectedDemo.id); onNavigate('demo-cargo') }}>VIEW CARGO</button></div><p className="simulated-note">SIMULATED position and route. This is not live AIS or ADS-B.</p>
        </section>}

        {selectedVessel && <section className="asset-focus selected-asset-card"><div className="focus-title-row"><div><p className="eyebrow">ASSET FOCUS · SHIP · {selectedVessel.status === 'live' ? 'LIVE AIS' : 'API'}</p><h3>{selectedVessel.ship_name || selectedVessel.mmsi}</h3><p className="selected-asset-name">MMSI {selectedVessel.mmsi}</p></div><button type="button" className="icon-button" aria-label="Close asset focus" onClick={clearSelection}>×</button></div><span className={`vessel-state vessel-state--${selectedVessel.status}`}>{selectedVessel.status}</span>
          <div className="tracking-focus-tabs" role="tablist" aria-label="Vessel information">{(['DETAILS', 'VOYAGE', 'HISTORY'] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
          {tab === 'DETAILS' && <div className="asset-data-grid"><div><small>POSITION</small><strong>{selectedVessel.latitude.toFixed(4)}, {selectedVessel.longitude.toFixed(4)}</strong></div><div><small>VESSEL TYPE</small><strong>{selectedVesselResource?.type || 'Unavailable'}</strong></div><div><small>SPEED</small><strong>{selectedVessel.speed_over_ground == null ? 'Unavailable' : `${selectedVessel.speed_over_ground} kn`}</strong></div><div><small>COURSE</small><strong>{selectedVessel.course_over_ground ?? selectedVessel.true_heading ?? 'Unavailable'}{selectedVessel.course_over_ground != null || selectedVessel.true_heading != null ? '°' : ''}</strong></div><div><small>OPERATION</small><strong>{selectedVesselExpedition?.code || selectedVesselExpedition?.name || 'Unavailable'}</strong></div><div><small>DESTINATION / ETA</small><strong>{selectedVesselLeg ? `${selectedVesselLeg.destination || 'Unavailable'} · ${selectedVesselLeg.planned_arrival ? formatDateTime(selectedVesselLeg.planned_arrival, true) : 'Unavailable'}` : 'Unavailable'}</strong></div><div><small>LAST UPDATE</small><strong>{formatDateTime(selectedVessel.received_at, true)}</strong></div></div>}
          {tab === 'VOYAGE' && <div className="asset-data-grid"><div><small>ROUTE</small><strong>{selectedVesselLeg ? `${selectedVesselLeg.origin || 'Unavailable'} → ${selectedVesselLeg.destination || 'Unavailable'}` : 'Unavailable'}</strong></div><div><small>OPERATION</small><strong>{selectedVesselExpedition?.code || selectedVesselExpedition?.name || 'Unavailable'}</strong></div><div><small>ETA</small><strong>{selectedVesselLeg?.planned_arrival ? formatDateTime(selectedVesselLeg.planned_arrival, true) : 'Unavailable'}</strong></div><div><small>CARGO</small><strong>{selectedVesselCargo.map((item) => item.tracking_code || item.cargo_id).join(', ') || 'Unavailable'}</strong></div></div>}
          {tab === 'HISTORY' && <div className="track-history"><strong>API AIS TRACK · {vesselTrack.length} POSITIONS</strong>{vesselTrack.slice(-8).reverse().map((fix, index) => <span key={`${fix.received_at}-${index}`}>{formatDateTime(fix.received_at, true)} · {fix.latitude.toFixed(4)}, {fix.longitude.toFixed(4)} · {fix.source}</span>)}</div>}
          <div className="btn-group"><button type="button" className="btn-primary-sm" onClick={() => { const next = !following; setFollowing(next); issueCamera({ point: { latitude: selectedVessel.latitude, longitude: selectedVessel.longitude }, zoom: 6 }) }}>{following ? 'STOP TRACKING' : 'TRACK / FOLLOW'}</button><button type="button" className="btn-secondary-sm" onClick={() => setTab('HISTORY')}>LOG</button>{selectedVesselLeg?.expedition_id && <button type="button" className="btn-secondary-sm" onClick={() => { sessionStorage.setItem('polaris_expedition_focus', selectedVesselLeg.expedition_id || ''); onNavigate('expeditions') }}>VIEW OPERATION</button>}{selectedVesselCargo.length > 0 && <button type="button" className="btn-secondary-sm" onClick={() => { sessionStorage.setItem('polaris_cargo_focus', selectedVesselCargo[0].cargo_id); onNavigate('cargo') }}>VIEW CARGO</button>}</div>
        </section>}

        {selectedRouteId && !selectedDemo && !selectedVessel && <section className="panel tracking-overview-card"><div className="panel-header"><div><p className="eyebrow">ROUTE FOCUS · {selectedLeg ? 'API' : 'DEMO / SIMULATED'}</p><h3>{selectedLeg ? `${selectedLeg.origin || 'Origin'} → ${selectedLeg.destination || 'Destination'}` : `${selectedRouteDemo?.origin || 'Origin'} → ${selectedRouteDemo?.destination || 'Destination'}`}</h3></div><button type="button" className="icon-button" aria-label="Close route focus" onClick={clearSelection}>×</button></div><div className="asset-data-grid"><div><small>STATUS</small><strong>{selectedLeg?.status || selectedRouteDemo?.status || 'Unavailable'}</strong></div><div><small>ASSET</small><strong>{selectedRouteResource?.name || selectedRouteDemo?.id || 'Unavailable'}</strong></div><div><small>OPERATION</small><strong>{selectedRouteExpedition?.code || selectedRouteExpedition?.name || selectedLeg?.expedition_id || selectedRouteDemo?.operationId || 'Unavailable'}</strong></div><div><small>PROGRESS</small><strong>{selectedRouteDemo ? `${Math.round(selectedRouteDemo.progress * 100)}%` : 'Unavailable'}</strong></div><div><small>ETA</small><strong>{selectedLeg?.planned_arrival ? formatDateTime(selectedLeg.planned_arrival, true) : selectedRouteDemo ? formatDateTime(selectedRouteDemo.eta, true) : 'Unavailable'}</strong></div><div><small>CARGO</small><strong>{selectedLeg ? selectedRouteCargo.map((cargo) => cargo.tracking_code || cargo.cargo_id).join(', ') || 'Unavailable' : selectedRouteDemo?.cargoIds.join(', ') || 'Unavailable'}</strong></div></div><button type="button" className="btn-secondary-sm" onClick={() => { if (selectedLeg?.expedition_id) { sessionStorage.setItem('polaris_expedition_focus', selectedLeg.expedition_id); onNavigate('expeditions') } else if (selectedRouteDemo) { sessionStorage.setItem('polaris_operation_focus', selectedRouteDemo.operationId); onNavigate('demo-operations') } }}>VIEW OPERATION</button></section>}

        {(selectedReference || selectedStation) && !selectedDemo && !selectedVessel && !selectedRouteId && <section className="panel tracking-overview-card"><div className="panel-header"><div><p className="eyebrow">STATION FOCUS · {selectedApiStation ? 'API' : 'DEMO / SIMULATED REFERENCE'}</p><h3>{selectedApiStation ? canonicalStationName(selectedApiStation) || 'Synthetic station reference' : selectedReference}</h3></div><button type="button" className="icon-button" aria-label="Close station focus" onClick={clearSelection}>×</button></div><p>{selectedApiStation ? selectedApiStation.status || 'Operational status unavailable' : referenceStations.find((station) => station.name === selectedReference)?.description || 'Network reference'}</p><p className="data-note">Coordinates {focusPoint ? `${focusPoint.latitude.toFixed(4)}, ${focusPoint.longitude.toFixed(4)}` : 'unavailable'} · {selectedApiStation ? 'API station record' : 'DEMO / SIMULATED reference coordinates'}</p>{selectedApiStation ? <div className="asset-data-grid"><div><small>PERSONNEL · API</small><strong>{stationPersonnel.length}</strong></div><div><small>ASSIGNMENTS · API</small><strong>{assignments.filter((assignment) => assignment.station_id === selectedStation).length}</strong></div><div><small>OPERATIONS · API</small><strong>{stationOperations.length}</strong></div><div><small>TRANSPORT · API</small><strong>{stationLegs.length}</strong></div><div><small>CARGO · API</small><strong>{stationCargo.length}</strong></div><div><small>INCIDENTS · API</small><strong>{stationIncidents.length}</strong></div></div> : <p className="data-note">Operational status, personnel, transport, cargo, and incident data are unavailable for this reference location.</p>}<button type="button" className="btn-secondary-sm" onClick={() => onNavigate('bases')}>VIEW BASE RECORDS</button></section>}

        {selectedApiIncident && <section className="panel tracking-overview-card"><div className="panel-header"><div><p className="eyebrow">INCIDENT FOCUS · API</p><h3>{selectedApiIncident.incident_id}</h3></div><button type="button" className="icon-button" aria-label="Close incident focus" onClick={clearSelection}>×</button></div><div className="asset-data-grid"><div><small>TYPE / SEVERITY</small><strong>{selectedApiIncident.type || 'Unavailable'} · {selectedApiIncident.severity || 'Unavailable'}</strong></div><div><small>STATUS</small><strong>{selectedApiIncident.status || 'Unavailable'}</strong></div><div><small>TIME</small><strong>{selectedApiIncident.declared_at ? formatDateTime(selectedApiIncident.declared_at, true) : 'Unavailable'}</strong></div><div><small>LOCATION</small><strong>{parsePoint(selectedApiIncident.location) ? `${parsePoint(selectedApiIncident.location)!.latitude.toFixed(4)}, ${parsePoint(selectedApiIncident.location)!.longitude.toFixed(4)}` : 'Unavailable'}</strong></div><div><small>SYNC STATUS</small><strong>Unavailable in API incident record</strong></div><div><small>DESCRIPTION</small><strong>{selectedApiIncident.description || 'Unavailable'}</strong></div></div><button type="button" className="btn-secondary-sm" onClick={() => onNavigate('incidents')}>VIEW INCIDENT</button></section>}
        {selectedDemoIncident && <section className="panel tracking-overview-card"><p className="eyebrow">INCIDENT FOCUS · DEMO / LOCAL</p><h3>{selectedDemoIncident.id}</h3><p>{selectedDemoIncident.type} · {selectedDemoIncident.severity} · {selectedDemoIncident.status}</p><p>{selectedDemoIncident.description}</p><button type="button" className="btn-secondary-sm" onClick={() => onNavigate('incidents')}>VIEW INCIDENT WORKFLOW</button></section>}

        {!selectedDemo && !selectedVessel && !selectedRouteId && !selectedReference && !selectedIncident && <>
          <section className="panel tracking-overview-card"><p className="eyebrow">OPERATIONAL OVERVIEW</p><div className="tracking-overview-grid"><div><small>TRACKED ASSETS</small><strong>{visibleDemoAssets.length + visibleVessels.length}</strong></div><div><small>API ROUTES</small><strong>{apiRoutes.length}</strong></div><div><small>STATIONS</small><strong>{stationMarkers.length + knownStationMarkers.length}</strong></div><div><small>API INCIDENTS</small><strong>{incidents.length}</strong></div></div><small>Asset counts include source-tagged DEMO / SIMULATED records.</small></section>
          <section className="panel tracking-overview-card"><p className="eyebrow">STATIONS</p><div className="tracking-stations">{referenceStations.map((station) => <button type="button" key={station.name} onClick={() => { clearSelection(); setSelectedReference(station.name); setFocusPoint(station.point); issueCamera({ point: station.point, zoom: 5 }) }}><span><strong>{station.name}</strong><small>{station.description} · {station.region}</small></span><em>DEMO / REFERENCE</em></button>)}</div></section>
          <section className="panel tracking-overview-card"><p className="eyebrow">ASSETS</p><div className="tracking-stations">{demoAssets.map((asset) => <button type="button" key={asset.id} onClick={() => selectAsset(asset.id)}><span><strong>{asset.id}</strong><small>{asset.kind === 'ship' ? 'SHIP' : 'AIRCRAFT'} · {asset.operationId}</small></span><em>{asset.status} · DEMO</em></button>)}{vessels.map((vessel) => <button type="button" key={vessel.mmsi} onClick={() => selectVessel(vessel)}><span><strong>{vessel.ship_name || vessel.mmsi}</strong><small>SHIP · {vessel.mmsi}</small></span><em>{vessel.status === 'live' ? 'LIVE AIS' : 'API'}</em></button>)}</div></section>
          <section className="panel tracking-overview-card"><p className="eyebrow">LIVE TRACKING PROVIDERS</p><div className="provider-state"><strong>AIS VESSEL FEED</strong><span>{aisState}</span><small>{aisState === 'LIVE' ? `Last provider update ${aisStatus?.last_message_at ? formatDateTime(aisStatus.last_message_at, true) : 'unavailable'}` : aisState === 'NOT CONFIGURED' ? 'Live AIS traffic is unavailable.' : 'Provider status supplied by the backend.'}</small></div><div className="provider-state"><strong>ADS-B AIRCRAFT FEED</strong><span>NOT CONFIGURED</span><small>Aircraft markers are DEMO / SIMULATED.</small></div>{aisError && <details><summary>Technical details</summary>{aisError}</details>}</section>
        </>}
        <p className="data-note">Geography © OpenStreetMap contributors. POLARIS operational overlays are sourced separately. DEMO / SIMULATED tracks are illustrative.</p>
      </aside>
    </div>
    <div className="map-status-strip"><span>ASSETS <strong>{visibleDemoAssets.length + visibleVessels.length}</strong> <small>DEMO {visibleDemoAssets.length} · API {visibleVessels.length}</small></span><span>ROUTES <strong>{apiRoutes.length + demoAssets.length}</strong></span><span>STATIONS <strong>{stationMarkers.length + knownStationMarkers.length}</strong></span><span>INCIDENTS <strong>{incidents.length}</strong></span><span>AIS <strong>{aisState}</strong></span></div>
  </div>
}

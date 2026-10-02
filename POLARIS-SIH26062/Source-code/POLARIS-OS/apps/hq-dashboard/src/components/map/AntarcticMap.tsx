import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import proj4 from 'proj4'
import antarcticaSource from '../../data/antarctica.geojson?raw'
import { apiGet } from '../../services/api'
import type { Incident, Station, TransportLeg } from '../../types'
import { formatDateTime, isSupportedIndianStation, recordLabel } from '../../utils/display'
import { demoOperationsStore, mockTrackingService } from '../../services/operations-demo'
import { demoBases, demoOperations } from '../../mock-data/operations'

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
const outerRadiusMeters = Math.hypot(...proj4('EPSG:4326', 'EPSG:3031', [0, -32]))
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
  if (latitude < -90 || latitude > -30 || longitude < -180 || longitude > 180) return null
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

type Props = { stations: Station[]; transportLegs: TransportLeg[]; incidents: Incident[]; onNavigate: (route:string)=>void }
export function AntarcticMap({ stations, transportLegs, incidents, onNavigate }: Props) {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [aisStatus, setAisStatus] = useState<AisStatus | null>(null)
  const [vesselError, setVesselError] = useState('')
  const [search, setSearch] = useState('')
  const [mapSearch,setMapSearch]=useState(()=>sessionStorage.getItem('polaris_map_search')||'')
  const [filter, setFilter] = useState('all')
  const [selectedMmsi, setSelectedMmsi] = useState('')
  const [selectedTrack, setSelectedTrack] = useState<Vessel[]>([])
  const [selectedDetails, setSelectedDetails] = useState<Vessel | null>(null)
  const [selectedDemoId, setSelectedDemoId] = useState(()=>sessionStorage.getItem('polaris_map_focus')||'')
  const [selectedBaseId,setSelectedBaseId]=useState(()=>sessionStorage.getItem('polaris_base_focus')||'')
  const [showDemoTrack, setShowDemoTrack] = useState(false)
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [followingId, setFollowingId] = useState('')
  const [mapZoom,setMapZoom]=useState(1)
  const [routesVisible,setRoutesVisible]=useState(true)
  const [waypointsVisible,setWaypointsVisible]=useState(true)
  const [basesVisible,setBasesVisible]=useState(true)
  const [fullScreen,setFullScreen]=useState(false)
  const demoState = useSyncExternalStore(demoOperationsStore.subscribe, demoOperationsStore.getState, demoOperationsStore.getState)
  const demoAssets = demoState.assets
  const selectedDemo = demoAssets.find(asset=>asset.id===selectedDemoId)
  const selectedBase=demoBases.find(base=>base.id===selectedBaseId)
  const supported = stations.filter(isSupportedIndianStation)
  const unsupportedCount = stations.length - supported.length
  const land = useMemo(() => landPaths(), [])

  useEffect(()=>{sessionStorage.removeItem('polaris_map_focus')},[])
  useEffect(()=>{sessionStorage.removeItem('polaris_base_focus');sessionStorage.removeItem('polaris_map_search')},[])

  useEffect(()=>{if(!followingId)return;return mockTrackingService.follow(followingId,()=>{})},[followingId])

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

  const stationMarkers = supported.length ? supported.map((station) => {
    const name: 'Maitri' | 'Bharati' = ((station.name || '').toLowerCase() === 'bharati' || (station.code || '').toLowerCase() === 'bharati') ? 'Bharati' : 'Maitri'
    const apiPoint = stationPoint(station)
    return { key: station.station_id, name, point: apiPoint || STATIC_REFERENCE[name], provenance: apiPoint ? 'API' : 'Static reference' }
  }) : (Object.entries(STATIC_REFERENCE) as ['Maitri'|'Bharati',Point][]).map(([name,point])=>({key:`DEMO-${name}`,name,point,provenance:'Static reference'}))
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
  const demoIncidentMarkers=demoState.incidents.filter(i=>(statusFilter==='ALL'||statusFilter===i.status)&&(entityFilter==='ALL'||entityFilter==='INCIDENTS')).map(i=>({key:i.id,name:`DEMO · ${i.type}`,point:project({latitude:i.point.lat,longitude:i.point.lon}),operationId:i.operationId}))
  const visibleTrack = [...selectedTrack].reverse().map((fix) => project({ latitude: fix.latitude, longitude: fix.longitude }))
  const operationalCoordinatesAvailable = stationMarkers.some((marker) => marker.provenance === 'API') || routeLines.length > 0 || incidentMarkers.length > 0 || demoAssets.length > 0
  const unsupportedStations = stations.filter((station) => !isSupportedIndianStation(station))
  const latitudeRings = [-60, -66.56, -70, -80].map((latitude) => {
    const p = project({ latitude, longitude: 0 })
    return { latitude, radius: Math.hypot(p.x - 50, p.y - 50) }
  })
  const visibleDemoAssets = demoAssets.filter(asset=>{
    const typeMatch=entityFilter==='ALL'||entityFilter==='SHIPS'&&asset.kind==='ship'||entityFilter==='FLIGHTS'&&asset.kind==='flight'||entityFilter==='CARGO'&&asset.cargoIds.length>0||entityFilter==='OPERATIONS'
    const statusMatch=statusFilter==='ALL'||entityFilter==='CARGO'?statusFilter==='ALL'||demoState.cargo.some(c=>asset.cargoIds.includes(c.id)&&c.status===statusFilter):asset.status===statusFilter
    const query=mapSearch.trim().toLowerCase();const employeeMatch=demoState.employees.some(e=>(e.assetId===asset.id||e.operationId===asset.operationId)&&`${e.id} ${e.name} ${e.role}`.toLowerCase().includes(query));const baseMatch=demoBases.some(b=>`${b.name} ${b.id}`.toLowerCase().includes(query)&&asset.destination.toLowerCase()===b.name.toLowerCase());const operationMatch=demoOperations.some(op=>op.id===asset.operationId&&`${op.id} ${op.name} ${op.type}`.toLowerCase().includes(query));const incidentMatch=demoState.incidents.some(i=>i.operationId===asset.operationId&&`${i.id} ${i.type} ${i.description}`.toLowerCase().includes(query))
    const queryMatch=!query||`${asset.id} ${asset.name} ${asset.registration} ${asset.imo??''} ${asset.mmsi??''} ${asset.operationId} ${asset.destination} ${asset.cargoIds.join(' ')}`.toLowerCase().includes(query)||employeeMatch||baseMatch||operationMatch||incidentMatch
    return typeMatch&&statusMatch&&queryMatch
  })
  const focusPoint=selectedDemo?project({latitude:selectedDemo.position.lat,longitude:selectedDemo.position.lon}):selectedBase?project({latitude:selectedBase.point.lat,longitude:selectedBase.point.lon}):null

  return <div className="operational-map">
    <div className="operational-map-toolbar"><div className="map-filter-row">{['ALL','SHIPS','FLIGHTS','CARGO','BASES','OPERATIONS','INCIDENTS'].map(item=><button type="button" key={item} className={`map-filter ${entityFilter===item?'active':''}`} onClick={()=>setEntityFilter(item)}>{item}</button>)}</div><div className="map-tools"><label>STATUS <select className="select-input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>ALL</option><option>IN TRANSIT</option><option>PLANNED</option><option>ARRIVED</option><option>DELAYED</option><option>EXCEPTION</option></select></label><label>SEARCH <input className="text-input" value={mapSearch} onChange={e=>setMapSearch(e.target.value)} placeholder="Ship, flight, cargo, operation, employee" /></label><button type="button" className="btn-secondary-sm" onClick={()=>{setSelectedDemoId('');setFollowingId('');setEntityFilter('ALL');setStatusFilter('ALL');setMapSearch('');setMapZoom(1)}}>Reset</button></div><div className="map-control-row"><button type="button" onClick={()=>setMapZoom(z=>Math.min(2.8,z+.2))}>Zoom +</button><button type="button" onClick={()=>setMapZoom(z=>Math.max(1,z-.2))}>Zoom −</button><button type="button" onClick={()=>{setSelectedDemoId('');setFollowingId('');setMapZoom(1)}}>Reset north</button><button type="button" onClick={()=>{setSelectedDemoId('POLAR-014');setMapZoom(1)}}>Fit route</button><button type="button" onClick={()=>setFullScreen(v=>!v)}>{fullScreen?'Exit full screen':'Full screen'}</button><button type="button" aria-pressed={routesVisible} onClick={()=>setRoutesVisible(v=>!v)}>{routesVisible?'Hide routes':'Show routes'}</button><button type="button" aria-pressed={waypointsVisible} onClick={()=>setWaypointsVisible(v=>!v)}>{waypointsVisible?'Hide waypoints':'Show waypoints'}</button><button type="button" aria-pressed={basesVisible} onClick={()=>setBasesVisible(v=>!v)}>{basesVisible?'Hide bases':'Show bases'}</button></div></div>
    <div className={`geo-context ${fullScreen?'map-fullscreen':''}`}>
    <div className="map-surface" role="group" aria-label="Interactive Antarctic operational map. Demo asset positions are simulated.">
      <svg className="map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <title>Antarctic operational map · EPSG:3031</title>
        <defs><clipPath id="antarctic-polar-clip"><circle cx="50" cy="50" r="42.8" /></clipPath></defs>
        <circle className="antarctic-map-boundary" cx="50" cy="50" r="43" />
        <g clipPath="url(#antarctic-polar-clip)"><g transform={`translate(50 50) scale(${mapZoom*(focusPoint?1.8:1)}) translate(${focusPoint?-focusPoint.x:-50} ${focusPoint?-focusPoint.y:-50})`}>
        {land.map(({ key, path }) => <path key={key} className="antarctica-land" d={path} />)}
        {latitudeRings.map((ring) => <g key={ring.latitude}><circle className="map-graticule" cx="50" cy="50" r={ring.radius} /><text className="map-grid-label" x="51" y={50 - ring.radius + 2}>{ring.latitude}°S</text></g>)}
        {Array.from({ length: 12 }, (_, index) => { const angle = (index * 30 * Math.PI) / 180; return <line key={index} className="map-graticule" x1="50" y1="50" x2={50 + 43 * Math.sin(angle)} y2={50 - 43 * Math.cos(angle)} /> })}
        <circle className="south-pole-marker" cx="50" cy="50" r="1.3" /><text className="map-grid-label" x="52" y="52">South Pole</text>
        {routesVisible&&routeLines.map((line) => <g key={line.key}><line className="map-route" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} /><text className="map-route-label" x={(line.start.x + line.end.x) / 2} y={(line.start.y + line.end.y) / 2 - 1}>{line.label}</text></g>)}
        {routesVisible&&visibleDemoAssets.map(asset=>{const route=asset.route.map(p=>project({latitude:p.lat,longitude:p.lon}));const point=project({latitude:asset.position.lat,longitude:asset.position.lon});const segment=Math.min(Math.floor(asset.progress*(route.length-1)),route.length-2);const completed=asset.progress>0?[...route.slice(0,segment+1),point]:[];const planned=asset.progress>0?[point,...route.slice(segment+1)]:route;return <g key={asset.id} className="demo-route" onClick={()=>{setSelectedDemoId(asset.id);setSelectedBaseId('');setSelectedMmsi('')}}>
          <polyline className="demo-route-planned" points={planned.map(p=>`${p.x},${p.y}`).join(' ')} />{completed.length>1&&<polyline className="demo-route-completed" points={completed.map(p=>`${p.x},${p.y}`).join(' ')} />}
          {asset.status==='IN TRANSIT'&&<polyline className="demo-route-current" points={`${point.x},${point.y} ${route[segment+1].x},${route[segment+1].y}`} />}
          {waypointsVisible&&route.map((p,i)=>i>0&&i<route.length-1?<circle key={`${asset.id}-wp-${i}`} className="demo-waypoint" cx={p.x} cy={p.y} r=".65"/>:null)}
          <circle className="demo-origin" cx={route[0].x} cy={route[0].y} r="1.3"/><text className="demo-route-label" x={route[0].x+1.5} y={route[0].y-1}>{asset.origin}</text><circle className="demo-destination" cx={route[route.length-1].x} cy={route[route.length-1].y} r="1.4"/><text className="demo-route-label" x={route[route.length-1].x+1.6} y={route[route.length-1].y-1}>{asset.destination}</text>
          <circle className={`demo-asset-marker ${asset.kind}`} cx={point.x} cy={point.y} r={selectedDemoId===asset.id?'2.1':'1.5'}><title>{asset.id} · DEMO / SIMULATED · {asset.status}</title></circle><text className="demo-asset-label" x={point.x+2} y={point.y+2}>{asset.id}</text>
          {entityFilter==='CARGO'&&demoState.cargo.filter(c=>asset.cargoIds.includes(c.id)).map((cargo,i)=><g key={cargo.id} className="cargo-map-marker" onClick={()=>{setSelectedDemoId(asset.id);setSelectedBaseId('');setSelectedMmsi('')}}><rect x={point.x+3} y={point.y-2+i*1.7} width="1.5" height="1.5" rx=".25"/><text x={point.x+5} y={point.y-1+i*1.7}>{cargo.id} · {cargo.status}</text></g>)}
        </g>})}
        {(entityFilter==='ALL'||entityFilter==='INCIDENTS')&&incidentMarkers.map((marker) => <g key={marker.key} className="map-incident-marker"><circle cx={marker.point.x} cy={marker.point.y} r="1.5" /><text className="map-incident-label" x={marker.point.x + 2} y={marker.point.y - 1}>{marker.name}</text></g>)}
        {demoIncidentMarkers.map(marker=><g key={marker.key} className="map-incident-marker demo-incident-marker" onClick={()=>{const asset=demoAssets.find(a=>a.operationId===marker.operationId);if(asset)setSelectedDemoId(asset.id)}}><circle cx={marker.point.x} cy={marker.point.y} r="1.8"/><text className="map-incident-label" x={marker.point.x+2} y={marker.point.y-1}>{marker.name}</text></g>)}
        {basesVisible&&(entityFilter==='ALL'||entityFilter==='BASES'||entityFilter==='OPERATIONS')&&stationMarkers.map((marker) => { const point = project(marker.point); return <g key={marker.key} className={`map-station-marker ${selectedBase?.name===marker.name?'selected':''}`} onClick={()=>{const base=demoBases.find(b=>b.name===marker.name);if(base){setSelectedBaseId(base.id);setSelectedDemoId('');setSelectedMmsi('')}}}><circle cx={point.x} cy={point.y} r={selectedBase?.name===marker.name?'2.8':'2'} /><text className="map-station-label" x={point.x + 2} y={point.y - 2}>{marker.name}</text></g> })}
        {visibleTrack.length > 1 && <polyline className="vessel-track" points={visibleTrack.map((p) => `${p.x},${p.y}`).join(' ')} />}
        {(entityFilter==='ALL'||entityFilter==='SHIPS')&&vessels.map((vessel) => { const point = project(vessel); return <g key={vessel.mmsi} className={`vessel-marker vessel-marker--${vessel.status}`} onClick={() => setSelectedMmsi(vessel.mmsi)}><title>{`${vessel.ship_name || 'Unknown vessel'} · MMSI ${vessel.mmsi} · ${vessel.status}`}</title><circle cx={point.x} cy={point.y} r={selectedMmsi === vessel.mmsi ? 2.3 : 1.7} /></g> })}
        {showDemoTrack&&selectedDemo&&selectedDemo.history.length>1&&<polyline className="demo-route-completed" points={selectedDemo.history.map(item=>project({latitude:item.point.lat,longitude:item.point.lon})).map(p=>`${p.x},${p.y}`).join(' ')}/>}
        </g></g>
      </svg>
      <div className="map-scale-label">DEMO / SIMULATED · Positions and ETA are illustrative</div>
    </div>
    <div className="geo-map-meta">
      <div className="map-legend"><strong>ROUTE KEY</strong><span><i className="legend-dash completed"/> Past track</span><span><i className="legend-dash"/> Planned route</span><span>◇ Waypoint · ○ Origin · ◎ Destination</span></div>
      {selectedBase&&!selectedDemo&&<section className="asset-focus base-focus"><p className="eyebrow">POLAR BASE ? DEMO ROSTER</p><h3>{selectedBase.name}</h3><p>{selectedBase.region}</p><div className="asset-data-grid"><div><small>PERSONNEL</small><strong>{demoState.employees.filter(e=>e.base===selectedBase.id).length}</strong></div><div><small>INCOMING CARGO</small><strong>{demoState.cargo.filter(c=>c.base===selectedBase.id&&!['RECEIVED','DELIVERED'].includes(c.status)).length} consignments</strong></div><div><small>OPERATIONS</small><strong>{demoOperations.filter(o=>o.destination.toUpperCase()===selectedBase.id).length}</strong></div><div><small>INCIDENTS</small><strong>{demoState.incidents.filter(i=>i.base===selectedBase.id&&i.status!=='RESOLVED').length}</strong></div></div><div className="btn-group"><button type="button" className="btn-secondary-sm" onClick={()=>onNavigate('bases')}>BASE DASHBOARD</button>{demoOperations.find(o=>o.destination.toUpperCase()===selectedBase.id)&&<button type="button" className="btn-secondary-sm" onClick={()=>{const op=demoOperations.find(o=>o.destination.toUpperCase()===selectedBase.id)!;sessionStorage.setItem('polaris_operation_focus',op.id);onNavigate('demo-operations')}}>VIEW OPERATION</button>}</div></section>}
      {selectedDemo&&<section className="asset-focus"><p className="eyebrow">{selectedDemo.kind==='ship'?'SHIP':'FLIGHT'} · DEMO / SIMULATED</p><h3>{selectedDemo.name}</h3><span className="vessel-state">{selectedDemo.status}</span><p>{selectedDemo.origin} → {selectedDemo.destination}</p><div className="asset-data-grid"><div><small>POSITION</small><strong>{selectedDemo.position.lat.toFixed(3)}°, {selectedDemo.position.lon.toFixed(3)}°</strong></div><div><small>{selectedDemo.kind==='ship'?'SPEED':'ALTITUDE'}</small><strong>{selectedDemo.kind==='ship'?`${selectedDemo.speed.toFixed(1)} kn`:`${selectedDemo.altitude??0} m`}</strong></div><div><small>HEADING</small><strong>{selectedDemo.heading}°</strong></div><div><small>ETA</small><strong>{new Date(selectedDemo.eta).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} UTC</strong></div><div><small>NEXT WAYPOINT</small><strong>{selectedDemo.nextWaypoint}</strong></div><div><small>OPERATION</small><strong>{selectedDemo.operationId}</strong></div><div><small>TYPE / REGISTRATION</small><strong>{selectedDemo.kind==='ship'?selectedDemo.vesselType:selectedDemo.aircraft} · {selectedDemo.registration}</strong></div><div><small>IMO / MMSI</small><strong>{selectedDemo.imo?`IMO ${selectedDemo.imo} · MMSI ${selectedDemo.mmsi}`:`Crew ${selectedDemo.crew??0}`}</strong></div><div><small>CARGO</small><strong>{selectedDemo.cargoIds.join(', ')} · {selectedDemo.cargoWeightKg.toLocaleString()} kg</strong></div><div><small>LAST UPDATE</small><strong>{new Date(selectedDemo.lastUpdate).toLocaleTimeString()}</strong></div></div><div className="btn-group"><button type="button" className="btn-secondary-sm" onClick={()=>setShowDemoTrack(x=>!x)}>{showDemoTrack?'HIDE TRACK':'VIEW TRACK'}</button>{followingId===selectedDemo.id?<button type="button" className="btn-primary-sm" onClick={()=>setFollowingId('')}>STOP FOLLOWING</button>:<button type="button" className="btn-primary-sm" onClick={()=>setFollowingId(selectedDemo.id)}>FOLLOW</button>}<button type="button" className="btn-secondary-sm" onClick={()=>{sessionStorage.setItem('polaris_cargo_focus',selectedDemo.id);onNavigate('demo-cargo')}}>VIEW CARGO</button><button type="button" className="btn-secondary-sm" onClick={()=>{sessionStorage.setItem('polaris_operation_focus',selectedDemo.operationId);onNavigate('demo-operations')}}>VIEW OPERATION</button></div><p className="simulated-note">This route position is simulated locally; it is not AIS or ADS-B data.</p>{showDemoTrack&&<div className="track-history"><strong>PAST TRACK · {selectedDemo.history.length} positions</strong>{selectedDemo.history.slice(-5).map((point,index)=><span key={`${point.at}-${index}`}>{new Date(point.at).toLocaleString()} · {point.point.lat.toFixed(3)}, {point.point.lon.toFixed(3)}</span>)}</div>}</section>}
      <p className="data-note">Natural Earth coastline · API records and clearly labeled local demo assets.</p>
      {!operationalCoordinatesAvailable && <div className="overlay-status" role="status"><div><strong>OPERATIONAL OVERLAYS</strong><span>Unavailable</span></div><button type="button" className="btn-secondary-sm" onClick={() => window.dispatchEvent(new Event('polaris:refresh'))}>Retry</button></div>}
      {unsupportedCount > 0 && <details className="quality-notice"><summary>Data quality · {unsupportedCount} station record(s) need review</summary><ul>{unsupportedStations.map((station) => <li key={station.station_id}>{recordLabel(station.name, station.code || station.station_id, 'Unnamed station')} <span className="station-quality-badge">DEMO / UNMAPPED</span></li>)}</ul></details>}
      <div className="map-station-list">{stationMarkers.map((station) => <div key={station.key}><strong>{station.name}</strong><span>{station.provenance === 'API' ? 'API coordinates' : 'Static station location'}</span><small>{Math.abs(station.point.latitude).toFixed(4)}°S, {station.point.longitude.toFixed(4)}°E</small></div>)}</div>
      <div className="map-global-bases">{demoBases.filter(base=>base.id==='NCPOR'||base.id==='HIMADRI').map(base=><div key={base.id}><strong>{base.name}</strong><small>{base.region} · outside Antarctic map extent</small></div>)}</div>
      {!selectedDemo&&<div className="demo-asset-list">{visibleDemoAssets.map(asset=><button key={asset.id} type="button" className="demo-asset-row" onClick={()=>{setSelectedDemoId(asset.id);setSelectedBaseId('');setSelectedMmsi('')}}><span className={`asset-type-mark ${asset.kind}`}>{asset.kind==='ship'?'S':'A'}</span><span><strong>{asset.id}</strong><small>{asset.origin} → {asset.destination} · {asset.operationId}</small></span><span className="vessel-state">{asset.status}</span></button>)}</div>}
      {(entityFilter==='ALL'||entityFilter==='SHIPS')&&<section className="vessel-panel" aria-label="Optional AIS vessel traffic">
        <div className="panel-header"><div><p className="eyebrow">OPTIONAL AIS PROVIDER</p><h3>{vessels.length ? `LIVE · ${vessels.length} AIS vessels` : 'AIS vessel feed'}</h3><p className="data-note">Provider status: <span className={`vessel-state ${aisStatus?.configured ? '' : 'vessel-state--stale'}`}>{aisStatus?.configured ? 'LIVE' : vesselError ? 'UNAVAILABLE' : aisStatus ? 'NOT CONFIGURED' : 'CHECKING'}</span>{aisStatus?.last_message_at ? ` · Last update ${formatDateTime(aisStatus.last_message_at, true)}` : ''}</p></div><button type="button" className="btn-secondary-sm" onClick={() => void refreshVessels()}>Refresh</button></div>
        {vesselError && <div className="map-data-warning" role="status"><strong>AIS DATA UNAVAILABLE</strong><span>Live vessel traffic could not be loaded.</span><details><summary>Technical details</summary>{vesselError}</details></div>}
        {aisStatus && !aisStatus.configured && <p className="map-data-warning" role="status">Live AIS traffic is unavailable because the AIS provider has not been configured.</p>}
        {aisStatus?.configured && <div className="toolbar-group"><label>Search vessels <input className="text-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ship name or MMSI" /></label><label>Feed age <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All</option><option value="live">Live (≤2 min)</option><option value="recent">Recent (2–30 min)</option><option value="stale">Stale (&gt;30 min)</option></select></label></div>}
        {vessels.length > 0 && <div className="table-scroll"><table><thead><tr><th>Vessel / MMSI</th><th>Position</th><th>Speed / course</th><th>Received</th><th>Status</th></tr></thead><tbody>{vessels.map((vessel) => <tr key={vessel.mmsi} className="vessel-row" onClick={() => setSelectedMmsi(vessel.mmsi)}><td>{recordLabel(vessel.ship_name, vessel.mmsi)}<small className="table-subtext">MMSI {vessel.mmsi}</small></td><td>{Math.abs(vessel.latitude).toFixed(3)}°S · {vessel.longitude.toFixed(3)}°</td><td>{vessel.speed_over_ground ?? '—'} kn · {vessel.course_over_ground ?? '—'}°</td><td>{formatDateTime(vessel.received_at, true)}</td><td><span className={`vessel-state vessel-state--${vessel.status}`}>{vessel.status}</span></td></tr>)}</tbody></table></div>}
        {selectedDetails && <div className="vessel-detail"><h4>{selectedDetails.ship_name || 'Unknown vessel'} · MMSI {selectedDetails.mmsi}</h4><p>Position {selectedDetails.latitude.toFixed(4)}, {selectedDetails.longitude.toFixed(4)} · heading {selectedDetails.true_heading ?? 'not reported'}° · source {selectedDetails.source}</p><p>{selectedTrack.length} received track points. No interpolation is performed between AIS reports.</p></div>}
        {!vesselError && aisStatus?.configured && vessels.length === 0 && <p className="data-note">No AIS vessel positions have been received for Antarctica yet.</p>}
      </section>}
      {routeLines.length === 0 && <p className="data-note">No transport routes with valid API endpoint coordinates.</p>}
      {incidentMarkers.length === 0 && incidents.length > 0 && <p className="data-note">Incident coordinates are unavailable from API.</p>}
      {!stationMarkers.length && <p className="data-note">No supported Maitri/Bharati station records returned by API.</p>}
    </div>
  </div></div>
}

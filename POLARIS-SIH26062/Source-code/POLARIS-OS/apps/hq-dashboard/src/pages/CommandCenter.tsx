import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AuditLog, CargoItem, Expedition, Incident, InventoryStock, Personnel, PersonnelAssignment, Recommendation, Station, TransportLeg, TransportResource, WeatherEvent } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { AntarcticMap } from '../components/map/AntarcticMap'
import { apiGet, ApiError } from '../services/api'
import { ErrorBanner } from '../components/common/ErrorBanner'
import { canonicalStationName, formatDateTime, isSupportedIndianStation, recordLabel, safeReference, stationLabelById, stationLabelByReference, redactDatabaseIds } from '../utils/display'
import { demoOperationsStore } from '../services/operations-demo'

type Props = {
  stations: Station[]; stationsError?: string; weatherError?: string; personnelError?: string; assignmentsError?: string; expeditions: Expedition[]; transportLegs: TransportLeg[]; cargoItems: CargoItem[]; resources?: TransportResource[]
  inventoryStocks: InventoryStock[]; personnel: Personnel[]; assignments: PersonnelAssignment[]
  incidents: Incident[]; recommendations: Recommendation[]; weatherEvents: WeatherEvent[]
  moduleErrors: Record<string, string>; onViewImpact: (id: string) => Promise<void>
  onNavigate: (route: string) => void; impactLoading: boolean; refreshMarker: string | null
}

export function CommandCenter({ stations, stationsError, weatherError, personnelError, assignmentsError, expeditions, transportLegs, cargoItems, resources = [], inventoryStocks, personnel, assignments, incidents, recommendations, weatherEvents, moduleErrors, onViewImpact, onNavigate, impactLoading, refreshMarker }: Props) {
  const demoState=useSyncExternalStore(demoOperationsStore.subscribe,demoOperationsStore.getState,demoOperationsStore.getState)
  const indianStations = stations.filter(isSupportedIndianStation)
  const unmappedStationCount = stations.filter((station) => !canonicalStationName(station)).length
  const [auditRows, setAuditRows] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')
  const [auditErrorDetails, setAuditErrorDetails] = useState<{ status?: number; endpoint?: string; requestId?: string; body?: string }>()
  const activeExpeditions = expeditions.filter((item) => !['cancelled', 'completed', 'closed'].includes((item.status ?? '').toLowerCase()))
  const openIncidents = incidents.filter((item) => !['resolved', 'closed'].includes((item.status ?? '').toLowerCase()))
  const attentionLegs = transportLegs.filter((leg) => ['delayed', 'cancelled', 'diverted', 'failed', 'disrupted'].includes((leg.status ?? '').toLowerCase()))
  const inventoryExceptions = inventoryStocks.filter((item) => item.quantity != null && item.reorder_threshold != null && Number.isFinite(Number(item.quantity)) && Number(item.quantity) < Number(item.reorder_threshold))
  const pendingRecommendations = recommendations.filter((item) => ['pending', 'in_review', 'requires_approval'].includes((item.status ?? '').toLowerCase()))

  useEffect(() => {
    let mounted = true
    apiGet<AuditLog[]>('/audit-logs').then((rows) => {
      if (!mounted) return
      setAuditRows(Array.isArray(rows) ? rows : [])
      setAuditError('')
    }).catch((error) => {
      if (!mounted) return
      setAuditRows([])
      setAuditError(error instanceof Error ? error.message : 'Audit records unavailable.')
      if (error instanceof ApiError) setAuditErrorDetails({ status: error.status, endpoint: error.endpoint, requestId: error.requestId, body: error.technicalDetails })
    }).finally(() => { if (mounted) setAuditLoading(false) })
    return () => { mounted = false }
  }, [refreshMarker])

  const demoOperations=demoState.operations.filter(operation=>operation.status!=='COMPLETED')
  const demoMoving=demoState.assets.filter(asset=>asset.status==='IN TRANSIT')
  const demoAvailable=demoState.employees.filter(person=>person.availability==='AVAILABLE')
  const demoCargoTransit=demoState.cargo.filter(item=>['DISPATCHED','IN TRANSIT','ARRIVED'].includes(item.status))
  const demoIncidents=demoState.incidents.filter(item=>!['RESOLVED','CLOSED'].includes(item.status))
  const pendingDemoRecommendations=demoState.recommendations.filter(item=>item.status==='PENDING APPROVAL').length
  const pendingDemoSchedules=demoState.scheduleRequests.filter(item=>item.status==='PENDING APPROVAL').length
  const demoPending=pendingDemoRecommendations+pendingDemoSchedules
  const demoApprovalRoute=pendingDemoRecommendations?'ai-operations':pendingDemoSchedules?'personnel':'ai-operations'
  const demoMetrics = [
    ['Active operations \u00b7 demo', demoOperations.length, 'demo-operations'],
    ['Assets moving \u00b7 demo', demoMoving.length, 'tracking'],
    ['Personnel available \u00b7 demo', demoAvailable.length, 'personnel'],
    ['Cargo in transit \u00b7 demo', demoCargoTransit.length, 'demo-cargo'],
    ['Active incidents \u00b7 demo', demoIncidents.length, 'incidents'],
    ['Pending approvals \u00b7 demo', demoPending, demoApprovalRoute],
  ] as const
  const apiMetrics = [
    ['Active expeditions · API', activeExpeditions.length, 'demo-operations', 'expeditions'],
    ['Transport legs · API', transportLegs.length, 'transport', 'transport'],
    ['Personnel assignments · API', assignments.length, 'personnel', 'personnel'],
    ['Cargo records · API', cargoItems.length, 'cargo', 'cargo'],
    ['Open incidents · API', openIncidents.length, 'incidents', 'incidents'],
    ['Pending recommendations · API', pendingRecommendations.length, 'recommendations', 'recommendations'],
  ] as const

  return <div className="page-container command-dashboard">
    <section className="operations-hero">
      <div className="operations-hero-copy"><p className="eyebrow">POLAR OPERATIONS INTELLIGENCE · DEMONSTRATION DATA</p><h2>One operational view<br />for a changing frontier.</h2><p>Movement, people, cargo and mission status across the polar network—together in one place.</p><div className="hero-context"><span>SEASON {activeExpeditions[0]?.season || '2026–27'}</span><span>{indianStations.length} BASE RECORDS</span><span>HQ · NCPOR</span></div></div>
      <div className="hero-stamp"><span className="hero-orbit" aria-hidden="true">✳</span><span>POLAR<br />OPERATIONS<br />SYSTEM</span><small>INDIA · SOUTHERN OCEAN</small></div>
    </section>
    <section className="context-strip">
      <div><span className="eyebrow">EXPEDITION CONTEXT</span><strong>{recordLabel(activeExpeditions[0]?.name || activeExpeditions[0]?.code, activeExpeditions[0]?.expedition_id, activeExpeditions.length ? 'Unresolved expedition record' : 'No active expedition data')}</strong></div>
      <div><span className="eyebrow">OPERATIONAL PERIOD</span><strong>{activeExpeditions[0]?.season || 'Not provided by API'}</strong></div>
      <div><span className="eyebrow">ANTARCTIC STATIONS</span><strong>{stationsError ? 'Station data unavailable' : indianStations.length ? indianStations.map((station) => stationLabelById(station.station_id, stations)).join(', ') : stations.length ? 'Station reference data requires reconciliation' : 'Station reference data unavailable'}</strong></div>
      <span className="provenance-tag">Backend data</span>
    </section>
    {unmappedStationCount > 0 && <div className="unavailable-state" role="status">Station reference data requires reconciliation for {unmappedStationCount} API record{unmappedStationCount === 1 ? '' : 's'}.</div>}
    <section className="panel map-panel"><div className="panel-header"><div><p className="eyebrow">MOVEMENT · POLAR NETWORK</p><h2>Operational map</h2><p className="data-note">API-backed records with separately labeled simulated vehicles</p></div><button type="button" className="btn-secondary" onClick={()=>onNavigate('tracking')}>Open full map</button></div><div className="map-body"><AntarcticMap stations={stations} transportLegs={transportLegs} incidents={openIncidents} expeditions={expeditions} cargoItems={cargoItems} resources={resources} onNavigate={onNavigate} /></div></section>
    <section className="metrics-table" aria-label="API-backed operational metrics">{apiMetrics.map(([label, value, route, module]) => <button key={label} type="button" className="metric-row" onClick={() => onNavigate(route)}><span>{label}</span><strong>{moduleErrors[module] ? 'Unavailable' : value}</strong><span className="metric-link">Open records</span></button>)}</section>

    <section className="panel"><div className="panel-header"><div><p className="eyebrow">ACTIVE OPERATIONS & MOVEMENTS · API</p><h2>Expedition activity</h2></div><button type="button" className="btn-link" onClick={() => onNavigate('demo-operations')}>Open operations</button></div><div className="situation-grid">
      <section><h3>Active expeditions</h3>{moduleErrors.expeditions ? <p className="data-note">Expedition data unavailable from API.</p> : activeExpeditions.length ? <div className="compact-list">{activeExpeditions.slice(0, 5).map((item) => <div className="compact-row" key={item.expedition_id}><div><strong>{recordLabel(item.name, item.code || item.expedition_id)}</strong><span>{item.season || 'Season not provided'} · API expedition</span></div><StatusPill status={item.status} /><button type="button" className="btn-link" onClick={() => onNavigate('demo-operations')}>Open</button></div>)}</div> : <EmptyState compact message="No active expedition records returned by the API." />}</section>
      <section><h3>Recent transport movements</h3>{moduleErrors.transport ? <p className="data-note">Transport data unavailable from API.</p> : transportLegs.length ? <div className="compact-list">{transportLegs.slice(0, 5).map((leg) => <div className="compact-row" key={leg.leg_id}><div><strong>{recordLabel(leg.code, leg.leg_id)}</strong><span>{stationLabelByReference(leg.origin, stations, 'origin')} to {stationLabelByReference(leg.destination, stations, 'destination')} · API</span></div><StatusPill status={leg.status} /><button type="button" className="btn-link" onClick={() => onNavigate('transport')}>Open</button></div>)}</div> : <EmptyState compact message="No transport legs returned by the API." />}</section>
    </div></section>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">OPERATIONAL SITUATION</p><h2>Exceptions and decisions</h2></div></div><div className="situation-grid">
      <section><h3>Transport requiring attention</h3>{moduleErrors.transport ? <p className="data-note">Transport data unavailable from API.</p> : attentionLegs.length ? <div className="compact-list">{attentionLegs.slice(0, 5).map((leg) => <div className="compact-row" key={leg.leg_id}><div><strong>{recordLabel(leg.code, leg.leg_id)}</strong><span>{stationLabelByReference(leg.origin, stations, 'origin')} to {stationLabelByReference(leg.destination, stations, 'destination')}</span></div><StatusPill status={leg.status} /><button className="btn-link" type="button" disabled={impactLoading} onClick={() => void onViewImpact(leg.leg_id)}>Impact</button></div>)}</div> : <EmptyState compact message="No transport exceptions reported by the API." />}</section>
      <section><h3>Inventory exceptions</h3>{moduleErrors.inventory ? <p className="data-note">Inventory data unavailable from API.</p> : inventoryExceptions.length ? <div className="compact-list">{inventoryExceptions.slice(0, 5).map((item) => <div className="compact-row" key={item.stock_id}><strong>{item.item_name || 'Item name unavailable'}</strong><span>{stationLabelById(item.station_id, stations)} - {item.quantity} / reorder {item.reorder_threshold}</span><StatusPill status={Number(item.quantity) === 0 ? 'out_of_stock' : 'low'} /></div>)}</div> : <EmptyState compact message="No quantities below reorder threshold." />}</section>
      <section><h3>Active incidents</h3>{moduleErrors.incidents ? <p className="data-note">Incident data unavailable from API.</p> : openIncidents.length ? <div className="compact-list">{openIncidents.slice(0, 5).map((incident) => <div className="compact-row" key={incident.incident_id}><div><strong>{recordLabel(null, incident.incident_id)}</strong><span>{incident.type || 'Incident'} - {stationLabelById(incident.station_id, stations)}</span></div><StatusPill status={incident.severity} /><StatusPill status={incident.status} /></div>)}</div> : <EmptyState compact message="No open incidents reported." />}</section>
      <section><h3>Personnel movement</h3>{assignmentsError ? <p className="data-note">Assignment data unavailable from API.</p> : assignments.length ? <div className="compact-list">{assignments.slice(0, 5).map((assignment) => { const person = personnel.find((entry) => entry.person_id === assignment.personnel_id || entry.personnel_id === assignment.personnel_id); return <div className="compact-row" key={assignment.assignment_id}><div><strong>{recordLabel(person?.name || [person?.first_name, person?.last_name].filter(Boolean).join(' '), person?.employee_code || person?.person_id || person?.personnel_id, 'Unresolved personnel reference')}</strong><span>{stationLabelById(assignment.station_id, stations)} - {assignment.leg_id ? recordLabel(transportLegs.find((leg) => leg.leg_id === assignment.leg_id)?.code, assignment.leg_id, 'Transport unavailable') : 'Transport unavailable'}</span>{!person && <small className="table-subtext">Assignment exists, but personnel details were not returned by the API.</small>}</div><StatusPill status={assignment.status} /></div>})}</div> : !personnelError && personnel.length ? <p className="data-note">Personnel roster: {personnel.length}. No assignment records returned.</p> : !personnelError ? <EmptyState compact message="No assignment records returned by the API." /> : <p className="data-note">Personnel data unavailable. No assignment records returned.</p>}</section>
      <section><h3>Pending recommendations</h3>{moduleErrors.recommendations ? <p className="data-note">Recommendation data unavailable from API.</p> : pendingRecommendations.length ? <div className="compact-list">{pendingRecommendations.slice(0, 5).map((rec, index) => <div className="compact-row" key={rec.recommendation_id || index}><div><strong>{redactDatabaseIds(rec.recommendation_type || 'Recommendation')}</strong><span>{typeof rec.proposed_change === 'string' ? redactDatabaseIds(rec.proposed_change) : 'Proposal details supplied as structured data'}</span></div><StatusPill status={rec.status} /><button type="button" className="btn-link" onClick={() => onNavigate('recommendations')}>Review</button></div>)}</div> : <EmptyState compact message="No recommendations marked pending by the API." />}</section>
      <section><h3>Environmental reports</h3>{weatherError ? <p className="data-note">Weather data unavailable from API.</p> : weatherEvents.length ? <div className="compact-list">{weatherEvents.slice(0, 4).map((event, index) => <div className="compact-row" key={event.event_id || event.weather_event_id || index}><strong>{event.event_type || 'Weather report'}</strong><span>{stationLabelById(event.station_id, stations)} - {event.notes || 'No notes'}</span><StatusPill status={event.severity} /></div>)}</div> : <EmptyState compact message="No weather records returned." />}</section>
    </div></section>

    <section className="panel"><div className="panel-header"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Canonical audit records</h2></div><button type="button" className="btn-link" onClick={() => onNavigate('audit')}>Open audit</button></div>{auditError ? <ErrorBanner message={`Audit records unavailable: ${auditError}`} details={auditErrorDetails} /> : auditLoading ? <p role="status" className="data-note">Loading audit records...</p> : auditRows.length ? <div className="table-scroll"><table><thead><tr><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Entity</th><th>Source</th></tr></thead><tbody>{auditRows.slice(0, 8).map((row) => <tr key={row.log_id}><td>{Number.isNaN(Date.parse(row.timestamp_utc)) ? 'Invalid timestamp' : formatDateTime(row.timestamp_utc)}</td><td>{safeReference(row.actor_user?.full_name || row.actor_user?.employee_code || row.actor, 'Not provided')}</td><td>{row.action}</td><td>{row.entity_type} - {safeReference(row.entity_id)}</td><td>{safeReference(row.sync_origin || row.device_id, 'Not provided')}</td></tr>)}</tbody></table></div> : <EmptyState compact message="No canonical audit records returned by the API." />}</section>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">LOCAL DEMONSTRATION METRICS</p><h2>Demo workflow activity</h2><p className="data-note">Synthetic records and browser-local demo events only. Excluded from API metrics above.</p></div><button type="button" className="btn-link" onClick={() => onNavigate('demo-history')}>Open demo history</button></div><section className="metrics-table demo-metrics" aria-label="Local demo workflow metrics">{demoMetrics.map(([label, value, route]) => <button key={label} type="button" className="metric-row" onClick={() => onNavigate(route)}><span>{label}</span><strong>{value}</strong><span className="metric-link">Open demo module</span></button>)}</section></section>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">LOCAL DEMO EVENTS · BROWSER ONLY</p><h2>Recent notifications</h2></div><button type="button" className="btn-link" onClick={() => onNavigate('demo-history')}>Open notifications &amp; history</button></div>{demoState.notifications.length ? <div className="compact-list panel-body">{demoState.notifications.slice(0,6).map(item=><div className="compact-row" key={item.id}><div><strong>{item.text}</strong><span>{formatDateTime(item.at,true)}</span></div><StatusPill status={item.read?'Read':'New'} /></div>)}</div> : <EmptyState compact message="Local demo approvals, incidents and operational actions will appear here." />}</section>
  </div>
}



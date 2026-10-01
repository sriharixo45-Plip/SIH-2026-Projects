import { useEffect, useState } from 'react'
import type { Approval, AuditLog, CargoItem, Expedition, Incident, InventoryStock, Personnel, PersonnelAssignment, Recommendation, Station, TransportLeg, WeatherEvent } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { AntarcticMap } from '../components/map/AntarcticMap'
import { apiGet, ApiError } from '../services/api'
import { ErrorBanner } from '../components/common/ErrorBanner'
import { formatDateTime, isSupportedIndianStation, recordLabel, safeReference, stationLabelById, stationLabelByReference, redactDatabaseIds } from '../utils/display'

type Props = {
  stations: Station[]; stationsError?: string; weatherError?: string; personnelError?: string; assignmentsError?: string; expeditions: Expedition[]; transportLegs: TransportLeg[]; cargoItems: CargoItem[]
  inventoryStocks: InventoryStock[]; personnel: Personnel[]; assignments: PersonnelAssignment[]
  incidents: Incident[]; recommendations: Recommendation[]; weatherEvents: WeatherEvent[]
  moduleErrors: Record<string, string>; onViewImpact: (id: string) => Promise<void>
  onNavigate: (route: string) => void; impactLoading: boolean; refreshMarker: string | null
}

export function CommandCenter({ stations, stationsError, weatherError, personnelError, assignmentsError, expeditions, transportLegs, cargoItems, inventoryStocks, personnel, assignments, incidents, recommendations, weatherEvents, moduleErrors, onViewImpact, onNavigate, impactLoading, refreshMarker }: Props) {
  const indianStations = stations.filter(isSupportedIndianStation)
  const unsupportedStationCount = stations.length - indianStations.length
  const [auditRows, setAuditRows] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')
  const [auditErrorDetails, setAuditErrorDetails] = useState<{ status?: number; endpoint?: string; requestId?: string; body?: string }>()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [approvalsAvailable, setApprovalsAvailable] = useState<boolean | null>(null)
  const activeExpeditions = expeditions.filter((item) => !['cancelled', 'completed', 'closed'].includes((item.status ?? '').toLowerCase()))
  const openIncidents = incidents.filter((item) => !['resolved', 'closed'].includes((item.status ?? '').toLowerCase()))
  const attentionLegs = transportLegs.filter((leg) => ['delayed', 'cancelled', 'diverted', 'failed', 'disrupted'].includes((leg.status ?? '').toLowerCase()))
  const inventoryExceptions = inventoryStocks.filter((item) => item.quantity != null && item.reorder_threshold != null && Number.isFinite(Number(item.quantity)) && Number(item.quantity) < Number(item.reorder_threshold))
  const pendingRecommendations = recommendations.filter((item) => ['pending', 'in_review', 'requires_approval'].includes((item.status ?? '').toLowerCase()))

  useEffect(() => {
    let mounted = true
    Promise.allSettled([apiGet<AuditLog[]>('/audit-logs'), apiGet<Approval[]>('/approvals')]).then(([audit, approval]) => {
      if (!mounted) return
      if (audit.status === 'fulfilled') { setAuditRows(Array.isArray(audit.value) ? audit.value : []); setAuditError('') }
      else { setAuditRows([]); setAuditError(audit.reason instanceof Error ? audit.reason.message : 'Audit records unavailable.'); if (audit.reason instanceof ApiError) setAuditErrorDetails({ status: audit.reason.status, endpoint: audit.reason.endpoint, requestId: audit.reason.requestId, body: audit.reason.technicalDetails }) }
      if (approval.status === 'fulfilled') { setApprovals(Array.isArray(approval.value) ? approval.value : []); setApprovalsAvailable(true) }
      else { setApprovals([]); setApprovalsAvailable(false) }
    }).finally(() => { if (mounted) setAuditLoading(false) })
    return () => { mounted = false }
  }, [refreshMarker])

  const metrics = [
    ['Active expeditions', activeExpeditions.length, 'expeditions'],
    ['Transport exceptions', attentionLegs.length, 'transport'],
    ['Cargo attention', cargoItems.filter((item) => ['damaged', 'delayed', 'held'].includes((item.status ?? '').toLowerCase())).length, 'cargo'],
    ['Inventory exceptions', inventoryExceptions.length, 'inventory'],
    ['Open incidents', openIncidents.length, 'incidents'],
    ['Pending approvals', approvalsAvailable === null ? 'Loading' : approvalsAvailable ? approvals.filter((item) => (item.decision || item.status || '').toLowerCase() === 'pending').length : 'Unavailable', 'approvals'],
  ] as const

  return <div className="page-container command-dashboard">
    <section className="context-strip">
      <div><span className="eyebrow">EXPEDITION CONTEXT</span><strong>{recordLabel(activeExpeditions[0]?.name || activeExpeditions[0]?.code, activeExpeditions[0]?.expedition_id, activeExpeditions.length ? 'Unresolved expedition record' : 'No active expedition data')}</strong></div>
      <div><span className="eyebrow">OPERATIONAL PERIOD</span><strong>{activeExpeditions[0]?.season || 'Not provided by API'}</strong></div>
      <div><span className="eyebrow">INDIAN STATIONS</span><strong>{stationsError ? 'Station data unavailable' : indianStations.length ? indianStations.map((station) => stationLabelById(station.station_id, stations)).join(', ') : 'No Maitri/Bharati records returned'}</strong></div>
      <span className="provenance-tag">Backend data</span>
    </section>
    {unsupportedStationCount > 0 && <div className="unavailable-state" role="status">Unsupported station record returned by API ({unsupportedStationCount}). Records are not relabeled as Maitri or Bharati.</div>}
    <section className="metrics-table" aria-label="Key operational metrics">{metrics.map(([label, value, route]) => <button key={label} type="button" className="metric-row" onClick={() => onNavigate(route)}><span>{label}</span><strong>{moduleErrors[route] ? 'Unavailable' : value}</strong><span className="metric-link">View module</span></button>)}</section>

    <section className="panel"><div className="panel-header"><div><p className="eyebrow">OPERATIONAL SITUATION</p><h2>Exceptions and decisions</h2></div></div><div className="situation-grid">
      <section><h3>Transport requiring attention</h3>{moduleErrors.transport ? <p className="data-note">Transport data unavailable from API.</p> : attentionLegs.length ? <div className="compact-list">{attentionLegs.slice(0, 5).map((leg) => <div className="compact-row" key={leg.leg_id}><div><strong>{recordLabel(leg.code, leg.leg_id)}</strong><span>{stationLabelByReference(leg.origin, stations, 'origin')} to {stationLabelByReference(leg.destination, stations, 'destination')}</span></div><StatusPill status={leg.status} /><button className="btn-link" type="button" disabled={impactLoading} onClick={() => void onViewImpact(leg.leg_id)}>Impact</button></div>)}</div> : <EmptyState compact message="No transport exceptions reported by the API." />}</section>
      <section><h3>Inventory exceptions</h3>{moduleErrors.inventory ? <p className="data-note">Inventory data unavailable from API.</p> : inventoryExceptions.length ? <div className="compact-list">{inventoryExceptions.slice(0, 5).map((item) => <div className="compact-row" key={item.stock_id}><strong>{item.item_name || 'Item name unavailable'}</strong><span>{stationLabelById(item.station_id, stations)} - {item.quantity} / reorder {item.reorder_threshold}</span><StatusPill status={Number(item.quantity) === 0 ? 'out_of_stock' : 'low'} /></div>)}</div> : <EmptyState compact message="No quantities below reorder threshold." />}</section>
      <section><h3>Active incidents</h3>{moduleErrors.incidents ? <p className="data-note">Incident data unavailable from API.</p> : openIncidents.length ? <div className="compact-list">{openIncidents.slice(0, 5).map((incident) => <div className="compact-row" key={incident.incident_id}><div><strong>{recordLabel(null, incident.incident_id)}</strong><span>{incident.type || 'Incident'} - {stationLabelById(incident.station_id, stations)}</span></div><StatusPill status={incident.severity} /><StatusPill status={incident.status} /></div>)}</div> : <EmptyState compact message="No open incidents reported." />}</section>
      <section><h3>Personnel movement</h3>{assignmentsError ? <p className="data-note">Assignment data unavailable from API.</p> : assignments.length ? <div className="compact-list">{assignments.slice(0, 5).map((assignment) => { const person = personnel.find((entry) => entry.person_id === assignment.personnel_id || entry.personnel_id === assignment.personnel_id); return <div className="compact-row" key={assignment.assignment_id}><div><strong>{recordLabel(person?.name || [person?.first_name, person?.last_name].filter(Boolean).join(' '), person?.employee_code || person?.person_id || person?.personnel_id, 'Unresolved personnel reference')}</strong><span>{stationLabelById(assignment.station_id, stations)} - {assignment.leg_id ? recordLabel(transportLegs.find((leg) => leg.leg_id === assignment.leg_id)?.code, assignment.leg_id, 'Transport unavailable') : 'Transport unavailable'}</span>{!person && <small className="table-subtext">Assignment exists, but personnel details were not returned by the API.</small>}</div><StatusPill status={assignment.status} /></div>})}</div> : !personnelError && personnel.length ? <p className="data-note">Personnel roster: {personnel.length}. No assignment records returned.</p> : !personnelError ? <EmptyState compact message="No assignment records returned by the API." /> : <p className="data-note">Personnel data unavailable. No assignment records returned.</p>}</section>
      <section><h3>Pending recommendations</h3>{moduleErrors.recommendations ? <p className="data-note">Recommendation data unavailable from API.</p> : pendingRecommendations.length ? <div className="compact-list">{pendingRecommendations.slice(0, 5).map((rec, index) => <div className="compact-row" key={rec.recommendation_id || index}><div><strong>{redactDatabaseIds(rec.recommendation_type || 'Recommendation')}</strong><span>{typeof rec.proposed_change === 'string' ? redactDatabaseIds(rec.proposed_change) : 'Proposal details supplied as structured data'}</span></div><StatusPill status={rec.status} /><button type="button" className="btn-link" onClick={() => onNavigate('recommendations')}>Review</button></div>)}</div> : <EmptyState compact message="No recommendations marked pending by the API." />}</section>
      <section><h3>Environmental reports</h3>{weatherError ? <p className="data-note">Weather data unavailable from API.</p> : weatherEvents.length ? <div className="compact-list">{weatherEvents.slice(0, 4).map((event, index) => <div className="compact-row" key={event.event_id || event.weather_event_id || index}><strong>{event.event_type || 'Weather report'}</strong><span>{stationLabelById(event.station_id, stations)} - {event.notes || 'No notes'}</span><StatusPill status={event.severity} /></div>)}</div> : <EmptyState compact message="No weather records returned." />}</section>
    </div></section>

    <section className="panel map-panel"><div className="panel-header"><div><p className="eyebrow">GEOGRAPHIC CONTEXT</p><h2>Antarctic station and route reference</h2></div><span className="provenance-tag">Static reference / API geometry</span></div><div className="map-body"><AntarcticMap stations={stations} transportLegs={transportLegs} incidents={openIncidents} /></div></section>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Canonical audit records</h2></div><button type="button" className="btn-link" onClick={() => onNavigate('audit')}>Open audit</button></div>{auditError ? <ErrorBanner message={`Audit records unavailable: ${auditError}`} details={auditErrorDetails} /> : auditLoading ? <p role="status" className="data-note">Loading audit records...</p> : auditRows.length ? <div className="table-scroll"><table><thead><tr><th>Time (UTC)</th><th>Actor</th><th>Action</th><th>Entity</th><th>Source</th></tr></thead><tbody>{auditRows.slice(0, 8).map((row) => <tr key={row.log_id}><td>{Number.isNaN(Date.parse(row.timestamp_utc)) ? 'Invalid timestamp' : formatDateTime(row.timestamp_utc)}</td><td>{safeReference(row.actor_user?.full_name || row.actor_user?.employee_code || row.actor, 'Not provided')}</td><td>{row.action}</td><td>{row.entity_type} - {safeReference(row.entity_id)}</td><td>{safeReference(row.sync_origin || row.device_id, 'Not provided')}</td></tr>)}</tbody></table></div> : <EmptyState compact message="No canonical audit records returned by the API." />}</section>
  </div>
}

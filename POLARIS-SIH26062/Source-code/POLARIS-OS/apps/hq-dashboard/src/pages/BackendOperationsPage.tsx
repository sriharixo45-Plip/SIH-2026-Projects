import { useEffect, useMemo, useState } from 'react'
import type { CargoItem, Expedition, Incident, Personnel, PersonnelAssignment, Station, TransportLeg, TransportResource } from '../types'
import { apiGet, apiPatch, ApiError } from '../services/api'
import { EmptyState } from '../components/common/EmptyState'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { recordLabel, stationLabelById } from '../utils/display'
import { DemoOperationsPage } from './DemoOperationsPages'

type Props = {
  expeditions: Expedition[]; expeditionsError?: string
  transportLegs: TransportLeg[]; personnel: Personnel[]; assignments: PersonnelAssignment[]
  cargoItems: CargoItem[]; incidents: Incident[]; stations: Station[]; resources: TransportResource[]
  onRefresh: () => void; onNavigate: (route: string) => void; actor: string
}

const expeditionStatuses = ['draft', 'planned', 'approved', 'in_progress', 'disrupted', 'completed', 'cancelled']
const operationalTimeline = ['PLANNED', 'PERSONNEL ASSIGNED', 'ASSET ASSIGNED', 'CARGO LOADED', 'DEPARTED', 'IN TRANSIT', 'ARRIVED', 'COMPLETED']

export function BackendOperationsPage(props: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [expeditionStations, setExpeditionStations] = useState<Station[]>([])
  const [stationError, setStationError] = useState('')
  const [stationsLoading, setStationsLoading] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const operations = props.expeditions
  const selected = operations.find((item) => item.expedition_id === selectedId) ?? operations[0]
  const legs = useMemo(() => selected ? props.transportLegs.filter((item) => item.expedition_id === selected.expedition_id) : [], [props.transportLegs, selected])
  const legIds = new Set(legs.map((leg) => leg.leg_id))
  const peopleAssignments = props.assignments.filter((item) => item.expedition_id === selected?.expedition_id)
  const linkedPeople = peopleAssignments.map((assignment) => ({ assignment, person: props.personnel.find((person) => person.person_id === assignment.personnel_id) })).filter((entry) => entry.person)
  const cargo = props.cargoItems.filter((item) => !!item.leg_id && legIds.has(item.leg_id))
  const incidents = props.incidents.filter((item) => (!!item.leg_id && legIds.has(item.leg_id)) || (!!item.station_id && legs.some((leg) => leg.destination === item.station_id || leg.origin === item.station_id)))
  const resources = legs.map((leg) => ({ leg, resource: props.resources.find((item) => item.resource_id === leg.transport_resource_id) }))
  useEffect(() => {
    if (!selected?.expedition_id) { setExpeditionStations([]); return }
    let active = true
    setStationsLoading(true); setStationError('')
    apiGet<Station[]>(`/expeditions/${selected.expedition_id}/stations`)
      .then((rows) => { if (active) setExpeditionStations(Array.isArray(rows) ? rows : []) })
      .catch((cause) => { if (active) { setExpeditionStations([]); setStationError(cause instanceof ApiError ? cause.message : 'Expedition station records are unavailable.') } })
      .finally(() => { if (active) setStationsLoading(false) })
    return () => { active = false }
  }, [selected?.expedition_id])
  const currentStatus = (selected?.status ?? '').toLowerCase().replaceAll('-', '_')
  const hasAssignment = linkedPeople.some(({ assignment }) => !['cancelled', 'unassigned'].includes((assignment.status ?? '').toLowerCase()))
  const hasAsset = legs.length > 0
  const cargoLoaded = cargo.some((item) => ['in_transit', 'in_storage_at_station', 'delivered'].includes((item.status ?? '').toLowerCase()))
  const legDeparted = legs.some((leg) => ['departed', 'in_transit', 'arrived'].includes((leg.status ?? '').toLowerCase().replaceAll('-', '_')))
  const legInTransit = legs.some((leg) => (leg.status ?? '').toLowerCase().replaceAll('-', '_') === 'in_transit')
  const legArrived = legs.some((leg) => (leg.status ?? '').toLowerCase() === 'arrived')
  const completed = currentStatus === 'completed'
  const stageDone = [currentStatus !== 'draft', hasAssignment, hasAsset, cargoLoaded, legDeparted, legInTransit, legArrived, completed]

  const saveStatus = async (next: string) => {
    if (!selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      await apiPatch(`/expeditions/${selected.expedition_id}`, { status: next })
      setNotice(`Expedition status saved as ${formatStatusLabel(next)}.`)
      props.onRefresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Expedition status could not be saved.')
    } finally { setBusy(false) }
  }

  if (showDemo) return <div><div className="page-container"><button className="btn-secondary" type="button" onClick={() => setShowDemo(false)}>Back to backend operations</button></div><DemoOperationsPage onNavigate={props.onNavigate} actor={props.actor} /></div>

  return <div className="page-container">
    <div className="notice-banner"><strong>BACKEND OPERATIONS</strong> Expedition and linked records below come from the authenticated API. Timeline steps are derived only from returned expedition, assignment, cargo, and transport statuses.</div>
    {props.expeditionsError && <div className="unavailable-state" role="status">Backend expedition data unavailable. {props.expeditionsError}</div>}
    {error && <div className="error-banner" role="alert">{error}</div>}{notice && <div className="notice-banner" role="status">{notice}</div>}
    {!props.expeditionsError && !operations.length ? <section className="panel"><EmptyState message="No expedition records returned by the API." /><div className="panel-body"><button className="btn-secondary" type="button" onClick={() => setShowDemo(true)}>Open clearly labeled local demo operations</button></div></section> : selected && <>
      <section className="panel" id="op-overview"><div className="panel-header"><div><p className="eyebrow">MISSION EXECUTION · API</p><h2>{recordLabel(selected.name, selected.expedition_id, 'Expedition name unavailable')}</h2><p className="data-note">{recordLabel(selected.code, selected.expedition_id)} · {selected.season || 'Season not provided'}</p></div><div className="toolbar-group"><label>Expedition<select className="select-input" value={selected.expedition_id} onChange={(event) => setSelectedId(event.target.value)}>{operations.map((item) => <option key={item.expedition_id} value={item.expedition_id}>{item.code || item.name || item.expedition_id}</option>)}</select></label><label>Backend status<select className="select-input" value={currentStatus} disabled={busy} onChange={(event) => void saveStatus(event.target.value)}>{expeditionStatuses.map((status) => <option key={status} value={status}>{formatStatusLabel(status)}</option>)}</select></label><button className="btn-secondary" type="button" disabled={busy} onClick={() => props.onRefresh()}>Refresh records</button></div></div>
        <div className="panel-body operation-summary-grid"><div><small>EXPEDITION</small><strong>{selected.expedition_id}</strong></div><div><small>STATUS</small><strong><StatusPill status={selected.status} /></strong></div><div><small>PLANNED PERIOD</small><strong>{selected.planned_start ? new Date(selected.planned_start).toLocaleDateString() : 'Not provided'} – {selected.planned_end ? new Date(selected.planned_end).toLocaleDateString() : 'Not provided'}</strong></div><div><small>PERSONNEL ASSIGNMENTS</small><strong>{peopleAssignments.length} API records</strong></div><div><small>TRANSPORT LEGS</small><strong>{legs.length} API records</strong></div><div><small>CARGO</small><strong>{cargo.length} API records</strong></div><div><small>ASSOCIATED STATIONS</small><strong>{stationsLoading ? 'Loading…' : expeditionStations.length ? expeditionStations.map((station) => stationLabelById(station.station_id, props.stations)).join(', ') : stationError ? 'Unavailable' : 'None returned'}</strong></div></div>
        {stationError && <p className="data-note panel-body" role="status">Station links unavailable: {stationError}</p>}
        <div className="operation-timeline" id="op-timeline">{operationalTimeline.map((step, index) => <div key={step} className={stageDone[index] ? 'complete' : ''}><i>{stageDone[index] ? '✓' : index + 1}</i><span>{step}</span></div>)}</div>
        <p className="data-note panel-body">The eight display stages are evidence markers, not a separate persisted lifecycle. The backend exposes expedition statuses and independent assignment, cargo, and transport lifecycles.</p>
      </section>
      <div className="demo-two-col"><section className="panel" id="op-assets-cargo"><div className="panel-header"><div><p className="eyebrow">TRANSPORT RESOURCES + ROUTES</p><h2>Assigned assets and cargo</h2></div><button className="btn-link" type="button" onClick={() => props.onNavigate('transport')}>Open transport</button></div><div className="panel-body">{resources.length ? resources.map(({ leg, resource }) => <div className="compact-row" key={leg.leg_id}><div><strong>{recordLabel(resource?.name, resource?.registration_code || leg.transport_resource_id, 'Transport resource details unavailable')}</strong><span>{leg.mode || 'Mode not provided'} · {recordLabel(leg.code, leg.leg_id)} · {leg.status || 'Status unavailable'}</span><span>{leg.origin || 'Origin unavailable'} → {leg.destination || 'Destination unavailable'}</span></div><button className="btn-link" type="button" onClick={() => props.onNavigate('tracking')}>VIEW MAP</button></div>) : <p className="data-note">No transport legs are linked to this expedition in the API response.</p>}{cargo.map((item) => <div className="compact-row" key={item.cargo_id}><div><strong>{recordLabel(item.tracking_code, item.cargo_id)}</strong><span>{item.description || 'Description unavailable'} · {item.weight ?? 'Weight unavailable'} kg · {formatStatusLabel(item.status)}</span></div><button className="btn-link" type="button" onClick={() => props.onNavigate('cargo')}>OPEN CARGO</button></div>)}</div></section>
        <section className="panel" id="op-personnel-incidents"><div className="panel-header"><div><p className="eyebrow">PERSONNEL / INCIDENTS</p><h2>{linkedPeople.length} personnel linked</h2></div><button className="btn-link" type="button" onClick={() => props.onNavigate('personnel')}>Open personnel</button></div><div className="panel-body">{linkedPeople.length ? linkedPeople.map(({ assignment, person }) => <div className="compact-row" key={assignment.assignment_id}><div><strong>{person!.name || person!.employee_code || person!.person_id}</strong><span>{person!.role_on_expedition || 'Role not provided'} · assignment {assignment.status || 'status unavailable'}</span></div></div>) : <p className="data-note">No linked personnel assignments were returned.</p>}<h3>Linked incidents · {incidents.length}</h3>{incidents.length ? incidents.map((incident) => <p className="data-note" key={incident.incident_id}>{incident.incident_id} · {formatStatusLabel(incident.type)} · {incident.severity || 'Severity unavailable'} · {incident.status || 'Status unavailable'}</p>) : <p className="data-note">No incidents could be linked through this expedition’s returned transport legs.</p>}</div></section></div>
      <section className="panel" id="op-route"><div className="panel-header"><div><p className="eyebrow">ROUTE / MOVEMENT</p><h2>API transport legs</h2></div><button className="btn-primary" type="button" onClick={() => props.onNavigate('tracking')}>VIEW MAP</button></div><div className="panel-body">{legs.length ? legs.map((leg) => <div className="compact-row" key={leg.leg_id}><div><strong>{leg.origin || 'Origin unavailable'} → {leg.destination || 'Destination unavailable'}</strong><span>{recordLabel(leg.code, leg.leg_id)} · {leg.mode || 'Mode unavailable'} · {leg.status || 'Status unavailable'}</span></div><StatusPill status={leg.status} /></div>) : <p className="data-note">No route records are linked to this expedition.</p>}<p className="data-note">Live positions are provided only by configured AIS vessel records. Aircraft without a live provider remain labeled simulated on the map.</p></div></section>
      <section className="panel" id="op-documents"><div className="panel-header"><div><p className="eyebrow">PLAN VERSIONS</p><h2>Current plan reference</h2></div></div><div className="panel-body"><p>{selected.current_plan_version_id ? `Current plan version: ${selected.current_plan_version_id}` : 'No current plan version is assigned.'}</p><p className="data-note">The API exposes plan version records. This view does not create or approve plan changes.</p></div></section>
    </>}
    <section className="panel"><div className="panel-body"><button className="btn-secondary" type="button" onClick={() => setShowDemo(true)}>Open clearly labeled local demo operations</button></div></section>
  </div>
}

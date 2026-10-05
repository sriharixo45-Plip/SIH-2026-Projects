import { useEffect, useMemo, useState } from 'react'
import type { CargoItem, Expedition, Incident, Personnel, PersonnelAssignment, Station, TransportLeg, TransportResource } from '../types'
import { apiGet, apiPatch, ApiError } from '../services/api'
import { EmptyState } from '../components/common/EmptyState'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { recordLabel, stationLabelById } from '../utils/display'
import { DemoOperationsPage } from './DemoOperationsPages'

type Props = {
  expeditions: Expedition[]
  expeditionsError?: string
  transportLegs: TransportLeg[]
  personnel: Personnel[]
  assignments: PersonnelAssignment[]
  cargoItems: CargoItem[]
  incidents: Incident[]
  stations: Station[]
  resources: TransportResource[]
  onRefresh: () => void
  onNavigate: (route: string) => void
  actor: string
}

const expeditionStatuses = ['draft', 'planned', 'approved', 'in_progress', 'disrupted', 'completed', 'cancelled']
const operationalTimeline = [
  'PLANNED',
  'PERSONNEL ASSIGNED',
  'ASSET ASSIGNED',
  'CARGO LOADED',
  'DEPARTED',
  'IN TRANSIT',
  'ARRIVED',
  'COMPLETED',
]

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

  const legs = useMemo(
    () => (selected ? props.transportLegs.filter((item) => item.expedition_id === selected.expedition_id) : []),
    [props.transportLegs, selected],
  )
  const legIds = useMemo(() => new Set(legs.map((leg) => leg.leg_id)), [legs])

  const peopleAssignments = useMemo(
    () => props.assignments.filter((item) => item.expedition_id === selected?.expedition_id),
    [props.assignments, selected?.expedition_id],
  )

  const linkedPeople = useMemo(
    () =>
      peopleAssignments
        .map((assignment) => ({
          assignment,
          person: props.personnel.find((person) => person.person_id === assignment.personnel_id),
        }))
        .filter((entry) => Boolean(entry.person)),
    [peopleAssignments, props.personnel],
  )

  const cargo = useMemo(
    () => props.cargoItems.filter((item) => Boolean(item.leg_id) && legIds.has(item.leg_id!)),
    [props.cargoItems, legIds],
  )

  const incidents = useMemo(
    () =>
      props.incidents.filter(
        (item) =>
          (Boolean(item.leg_id) && legIds.has(item.leg_id!)) ||
          (Boolean(item.station_id) && legs.some((leg) => leg.destination === item.station_id || leg.origin === item.station_id)),
      ),
    [props.incidents, legIds, legs],
  )

  const resources = useMemo(
    () =>
      legs.map((leg) => ({
        leg,
        resource: props.resources.find((item) => item.resource_id === leg.transport_resource_id),
      })),
    [legs, props.resources],
  )

  useEffect(() => {
    if (!selected?.expedition_id) {
      setExpeditionStations([])
      return
    }
    let active = true
    setStationsLoading(true)
    setStationError('')
    apiGet<Station[]>(`/expeditions/${selected.expedition_id}/stations`)
      .then((rows) => {
        if (active) setExpeditionStations(Array.isArray(rows) ? rows : [])
      })
      .catch((cause) => {
        if (active) {
          setExpeditionStations([])
          setStationError(cause instanceof ApiError ? cause.message : 'Expedition station records are unavailable.')
        }
      })
      .finally(() => {
        if (active) setStationsLoading(false)
      })
    return () => {
      active = false
    }
  }, [selected?.expedition_id])

  const currentStatus = (selected?.status ?? '').toLowerCase().replaceAll('-', '_')
  const hasAssignment = linkedPeople.some(
    ({ assignment }) => !['cancelled', 'unassigned'].includes((assignment.status ?? '').toLowerCase()),
  )
  const hasAsset = legs.length > 0
  const cargoLoaded = cargo.some((item) =>
    ['in_transit', 'in_storage_at_station', 'delivered'].includes((item.status ?? '').toLowerCase()),
  )
  const legDeparted = legs.some((leg) =>
    ['departed', 'in_transit', 'arrived'].includes((leg.status ?? '').toLowerCase().replaceAll('-', '_')),
  )
  const legInTransit = legs.some((leg) => (leg.status ?? '').toLowerCase().replaceAll('-', '_') === 'in_transit')
  const legArrived = legs.some((leg) => (leg.status ?? '').toLowerCase() === 'arrived')
  const completed = currentStatus === 'completed'
  const stageDone = [
    currentStatus !== 'draft',
    hasAssignment,
    hasAsset,
    cargoLoaded,
    legDeparted,
    legInTransit,
    legArrived,
    completed,
  ]

  const saveStatus = async (next: string) => {
    if (!selected) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await apiPatch(`/expeditions/${selected.expedition_id}`, { status: next })
      setNotice(`Expedition status saved as ${formatStatusLabel(next)}.`)
      props.onRefresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Expedition status could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (showDemo) {
    return (
      <div>
        <div className="page-container" style={{ marginBottom: '1rem' }}>
          <button className="btn-secondary" type="button" onClick={() => setShowDemo(false)}>
            ← Back to Authoritative Backend Operations
          </button>
        </div>
        <DemoOperationsPage onNavigate={props.onNavigate} actor={props.actor} />
      </div>
    )
  }

  return (
    <div className="page-container operations-page-layout">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">MISSION EXECUTION & LOGISTICS ORCHESTRATION</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>Mission Operations</h2>
          <p className="page-subtitle">
            Lifecycle tracking, multi-asset coordination, personnel deployments, and real-time cargo movement across polar operations.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" type="button" onClick={() => setShowDemo(true)}>
            Open Synthetic Demo
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Operations Metrics">
        <div className="kpi-card">
          <span className="kpi-label">TOTAL EXPEDITIONS</span>
          <span className="kpi-value">{operations.length}</span>
          <span className="kpi-hint">Missions in database</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">LINKED PERSONNEL</span>
          <span className="kpi-value info">{linkedPeople.length}</span>
          <span className="kpi-hint">Assigned to selected mission</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">TRANSPORT LEGS</span>
          <span className="kpi-value warning">{legs.length}</span>
          <span className="kpi-hint">Active routes & transit</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">CARGO ITEMS</span>
          <span className="kpi-value success">{cargo.length}</span>
          <span className="kpi-hint">Manifest items attached</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">LINKED INCIDENTS</span>
          <span className="kpi-value alert">{incidents.length}</span>
          <span className="kpi-hint">Safety & delay reports</span>
        </div>
      </section>

      {props.expeditionsError && (
        <div className="unavailable-state" role="status">
          Backend expedition data unavailable. {props.expeditionsError}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice-banner" role="status">
          {notice}
        </div>
      )}

      {!props.expeditionsError && operations.length === 0 ? (
        <section className="panel">
          <EmptyState message="No expedition records returned by the API." />
          <div className="panel-body">
            <button className="btn-secondary" type="button" onClick={() => setShowDemo(true)}>
              Open local demo operations
            </button>
          </div>
        </section>
      ) : selected ? (
        <>
          {/* Main Mission Overview Panel */}
          <section className="panel" id="op-overview">
            <div className="panel-header">
              <div>
                <div className="page-title-row">
                  <span className="badge-tag">EXPEDITION</span>
                  <code className="record-code">{recordLabel(selected.code, selected.expedition_id)}</code>
                  <span className="text-secondary">{selected.season || 'Season N/A'}</span>
                </div>
                <h3>{recordLabel(selected.name, selected.expedition_id, 'Expedition name unavailable')}</h3>
              </div>
              <div className="toolbar-group">
                <label className="filter-label" htmlFor="op-expedition-select">
                  Select Mission:
                </label>
                <select
                  id="op-expedition-select"
                  className="select-input"
                  value={selected.expedition_id}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {operations.map((item) => (
                    <option key={item.expedition_id} value={item.expedition_id}>
                      {item.code || item.name || item.expedition_id}
                    </option>
                  ))}
                </select>

                <label className="filter-label" htmlFor="op-status-select">
                  Status:
                </label>
                <select
                  id="op-status-select"
                  className="select-input"
                  value={currentStatus}
                  disabled={busy}
                  onChange={(event) => void saveStatus(event.target.value)}
                >
                  {expeditionStatuses.map((st) => (
                    <option key={st} value={st}>
                      {formatStatusLabel(st)}
                    </option>
                  ))}
                </select>

                <button
                  className="btn-secondary-sm"
                  type="button"
                  disabled={busy}
                  onClick={() => props.onRefresh()}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Quick Metadata Grid */}
            <div className="operation-summary-grid">
              <div>
                <span className="kpi-label">STATUS</span>
                <StatusPill status={selected.status} />
              </div>
              <div>
                <span className="kpi-label">SCHEDULED WINDOW</span>
                <span className="detail-value">
                  {selected.planned_start ? new Date(selected.planned_start).toLocaleDateString() : '—'} →{' '}
                  {selected.planned_end ? new Date(selected.planned_end).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="kpi-label">ASSOCIATED STATIONS</span>
                <span className="detail-value">
                  {stationsLoading
                    ? 'Loading…'
                    : expeditionStations.length
                      ? expeditionStations.map((station) => stationLabelById(station.station_id, props.stations)).join(', ')
                      : stationError
                        ? 'Unavailable'
                        : 'None returned'}
                </span>
              </div>
              <div>
                <span className="kpi-label">PLAN VERSION</span>
                <code className="code-badge">{selected.current_plan_version_id || 'v1.0 (Draft)'}</code>
              </div>
            </div>

            {/* 8-Stage Derived Operational Timeline */}
            <div className="timeline-strip-container">
              <span className="section-label">OPERATIONAL EXECUTION EVIDENCE STAGES</span>
              <div className="operation-timeline" id="op-timeline">
                {operationalTimeline.map((step, index) => (
                  <div key={step} className={`timeline-step ${stageDone[index] ? 'complete' : ''}`}>
                    <div className="step-circle">{stageDone[index] ? '✓' : index + 1}</div>
                    <span className="step-label">{step}</span>
                  </div>
                ))}
              </div>
              <p className="data-note" style={{ marginTop: '8px' }}>
                Stages reflect verifiable evidence computed from returned assignment, transit, and cargo statuses.
              </p>
            </div>
          </section>

          {/* Two-Column Assets and Personnel Grid */}
          <div className="demo-two-col">
            {/* Transport Assets & Cargo */}
            <section className="panel" id="op-assets-cargo">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">TRANSPORT LOGISTICS</p>
                  <h3>Assigned Assets &amp; Cargo</h3>
                </div>
                <button className="btn-link" type="button" onClick={() => props.onNavigate('transport')}>
                  Open Transport →
                </button>
              </div>
              <div className="panel-body">
                <span className="section-label">ASSIGNED VESSELS / VEHICLES ({resources.length})</span>
                {resources.length ? (
                  resources.map(({ leg, resource }) => (
                    <div className="compact-row" key={leg.leg_id}>
                      <div>
                        <strong>
                          {recordLabel(resource?.name, resource?.registration_code || leg.transport_resource_id, 'Asset details unavailable')}
                        </strong>
                        <span className="table-subtext">
                          {leg.mode || 'Mode N/A'} · {recordLabel(leg.code, leg.leg_id)} · {leg.status}
                        </span>
                        <span className="route-arrow">
                          {leg.origin || 'Origin'} → {leg.destination || 'Destination'}
                        </span>
                      </div>
                      <button className="btn-secondary-sm" type="button" onClick={() => props.onNavigate('tracking')}>
                        Map
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="data-note">No transport legs linked to this expedition.</p>
                )}

                <span className="section-label" style={{ marginTop: '16px' }}>ATTACHED CARGO MANIFEST ({cargo.length})</span>
                {cargo.length ? (
                  cargo.map((item) => (
                    <div className="compact-row" key={item.cargo_id}>
                      <div>
                        <code className="record-code">{recordLabel(item.tracking_code, item.cargo_id)}</code>
                        <span className="detail-value">{item.description || 'General Cargo'}</span>
                        <span className="table-subtext">
                          {item.weight != null ? `${item.weight} kg` : 'Weight N/A'} · {formatStatusLabel(item.status)}
                        </span>
                      </div>
                      <button className="btn-secondary-sm" type="button" onClick={() => props.onNavigate('cargo')}>
                        Manifest
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="data-note">No cargo items assigned to this expedition’s transport legs.</p>
                )}
              </div>
            </section>

            {/* Personnel & Incidents */}
            <section className="panel" id="op-personnel-incidents">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">FIELD TEAMS & SAFETY</p>
                  <h3>Personnel &amp; Incidents</h3>
                </div>
                <button className="btn-link" type="button" onClick={() => props.onNavigate('personnel')}>
                  Open Personnel →
                </button>
              </div>
              <div className="panel-body">
                <span className="section-label">DEPLOYED TEAM MEMBERS ({linkedPeople.length})</span>
                {linkedPeople.length ? (
                  linkedPeople.map(({ assignment, person }) => (
                    <div className="compact-row" key={assignment.assignment_id}>
                      <div>
                        <strong>{person!.name || person!.employee_code || person!.person_id}</strong>
                        <span className="table-subtext">
                          {person!.role_on_expedition || 'Specialist'} · Assignment: {assignment.status || 'Active'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="data-note">No personnel currently assigned to this expedition.</p>
                )}

                <span className="section-label" style={{ marginTop: '16px' }}>LINKED OPERATIONAL INCIDENTS ({incidents.length})</span>
                {incidents.length ? (
                  incidents.map((incident) => (
                    <div className="compact-row" key={incident.incident_id}>
                      <div>
                        <strong>{incident.description || formatStatusLabel(incident.type)}</strong>
                        <span className="table-subtext">
                          Severity: {incident.severity} · Status: {incident.status}
                        </span>
                      </div>
                      <StatusPill status={incident.status} />
                    </div>
                  ))
                ) : (
                  <p className="data-note">No active incidents linked to this expedition or route.</p>
                )}
              </div>
            </section>
          </div>

          {/* Route Segments Table */}
          <section className="panel" id="op-route">
            <div className="panel-header">
              <div>
                <p className="eyebrow">TRANSIT LEGS</p>
                <h3>Route Segments ({legs.length})</h3>
              </div>
              <button className="btn-primary" type="button" onClick={() => props.onNavigate('tracking')}>
                View Unified Movement Map
              </button>
            </div>
            <div className="table-scroll">
              <table className="dense-table" aria-label="Route Segments">
                <thead>
                  <tr>
                    <th>Leg Code</th>
                    <th>Mode</th>
                    <th>Origin → Destination</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((leg) => (
                    <tr key={leg.leg_id}>
                      <td>
                        <code className="record-code">{recordLabel(leg.code, leg.leg_id)}</code>
                      </td>
                      <td>
                        <span className="mode-tag">{leg.mode || 'Transit'}</span>
                      </td>
                      <td>
                        <strong>{leg.origin || 'Origin N/A'} → {leg.destination || 'Destination N/A'}</strong>
                      </td>
                      <td>
                        <StatusPill status={leg.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

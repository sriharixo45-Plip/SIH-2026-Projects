import { useMemo, useState } from 'react'
import type { CargoItem, Personnel, PersonnelAssignment, Station, TransportLeg, TransportResource } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { formatDateTime, recordLabel, stationLabelByReference } from '../utils/display'

type Props = {
  transportLegs: TransportLeg[]
  dataError?: string
  dataErrors?: Record<string, string>
  resources: TransportResource[]
  cargoItems: CargoItem[]
  personnel: Personnel[]
  assignments: PersonnelAssignment[]
  stations: Station[]
  onCancelLeg: (id: string) => Promise<void>
  onViewImpact: (id: string) => Promise<void>
  cancelingLegId: string | null
  impactLoading: boolean
}

export function TransportPage({
  transportLegs, dataError, dataErrors = {}, resources, cargoItems,
  personnel, assignments, stations, onCancelLeg, onViewImpact, cancelingLegId, impactLoading
}: Props) {
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() =>
    transportLegs.filter((leg) =>
      (status === 'all' || (leg.status || '').toLowerCase() === status) &&
      `${leg.code || ''} ${leg.origin || ''} ${leg.destination || ''} ${leg.mode || ''}`.toLowerCase().includes(query.toLowerCase())
    ),
    [transportLegs, status, query]
  )

  const kpi = useMemo(() => {
    const active = transportLegs.filter(l => ['in_transit', 'in transit'].includes((l.status ?? '').toLowerCase())).length
    const planned = transportLegs.filter(l => (l.status ?? '').toLowerCase() === 'planned').length
    const completed = transportLegs.filter(l => (l.status ?? '').toLowerCase() === 'completed').length
    const delayed = transportLegs.filter(l => (l.status ?? '').toLowerCase() === 'delayed').length
    const cancelled = transportLegs.filter(l => ['cancelled', 'canceled'].includes((l.status ?? '').toLowerCase())).length
    return { active, planned, completed, delayed, cancelled }
  }, [transportLegs])

  function getRowClass(leg: TransportLeg): string {
    const s = (leg.status ?? '').toLowerCase()
    if (['cancelled', 'canceled'].includes(s)) return 'is-warning'
    if (s === 'delayed') return 'is-warning'
    if (s === 'in_transit') return ''
    return ''
  }

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="op-page-header">
        <div className="op-page-header-left">
          <p className="op-page-eyebrow">
            MOVEMENT OPERATIONS
            <span className="prov-chip api">API</span>
          </p>
          <h1 className="op-page-title">Transport</h1>
          <p className="op-page-desc">Movement of personnel, cargo and resources across all transport legs.</p>
        </div>
        <div className="op-page-header-right">
          {dataError && <span className="prov-chip unavail">DATA UNAVAILABLE</span>}
        </div>
      </div>

      {/* KPI STRIP */}
      {!dataError && (
        <div className="op-kpi-strip">
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Total legs</span>
            <span className="op-kpi-value">{transportLegs.length}</span>
            <span className="op-kpi-sub">all transport records</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">In transit</span>
            <span className={`op-kpi-value${kpi.active > 0 ? ' kpi-success' : ' kpi-muted'}`}>{kpi.active}</span>
            <span className="op-kpi-sub">currently moving</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Planned</span>
            <span className="op-kpi-value">{kpi.planned}</span>
            <span className="op-kpi-sub">scheduled</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Completed</span>
            <span className="op-kpi-value kpi-muted">{kpi.completed}</span>
            <span className="op-kpi-sub">delivered</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Delayed</span>
            <span className={`op-kpi-value${kpi.delayed > 0 ? ' kpi-warning' : ' kpi-muted'}`}>{kpi.delayed}</span>
            <span className="op-kpi-sub">behind schedule</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Cancelled</span>
            <span className={`op-kpi-value${kpi.cancelled > 0 ? ' kpi-warning' : ' kpi-muted'}`}>{kpi.cancelled}</span>
            <span className="op-kpi-sub">cancelled legs</span>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="op-filter-bar">
        <span className="op-filter-label">Status</span>
        <select className="select-input" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All</option>
          <option value="planned">Planned</option>
          <option value="in_transit">In transit</option>
          <option value="delayed">Delayed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <div className="op-filter-sep" />
        <input className="text-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Code, route, mode…" aria-label="Search transport legs" />
        <div className="op-filter-spacer" />
        <span className="data-note" style={{ fontSize: '10px' }}>Showing {filtered.length} of {transportLegs.length}</span>
      </div>

      {/* MAIN CONTENT */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">LOGISTICS CONTROL BOARD</p>
            <h2>{dataError ? 'Transport data unavailable' : `Transport legs (${filtered.length})`}</h2>
          </div>
        </div>

        {dataError ? (
          <div className="panel-body">
            <div className="op-empty-state">
              <div className="op-empty-icon">⚠</div>
              <p className="op-empty-title">TRANSPORT DATA UNAVAILABLE</p>
              <p className="op-empty-desc">{dataError}</p>
              <span className="op-empty-source">SOURCE: API · REQUEST FAILED</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel-body">
            <div className="op-empty-state">
              <div className="op-empty-icon">🚢</div>
              <p className="op-empty-title">NO TRANSPORT LEGS FOUND</p>
              <p className="op-empty-desc">No transport legs match the current filters.</p>
              <span className="op-empty-source">SOURCE: API</span>
            </div>
          </div>
        ) : (
          <div className="op-table-wrap">
            <table className="op-table">
              <thead>
                <tr>
                  <th>Leg / asset</th>
                  <th>Route</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Departure</th>
                  <th>Arrival</th>
                  <th>Cargo</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((leg) => {
                  const cargo = cargoItems.filter(item => item.leg_id === leg.leg_id)
                  const assigned = assignments.filter(item => item.leg_id === leg.leg_id)
                  const resource = resources.find(item => item.resource_id === leg.transport_resource_id)
                  const names = assigned.map(a => {
                    const person = personnel.find(p => p.person_id === a.personnel_id || p.personnel_id === a.personnel_id)
                    return recordLabel(person?.name || [person?.first_name, person?.last_name].filter(Boolean).join(' '), person?.employee_code || (person?.person_id ?? person?.personnel_id), 'Unresolved')
                  })
                  return (
                    <tr key={leg.leg_id} className={getRowClass(leg)}>
                      <td>
                        <span className="op-cell-mono">{recordLabel(leg.code, leg.leg_id)}</span>
                        <span className="op-cell-secondary">
                          {dataErrors['/transport-resources']
                            ? 'Asset data unavailable'
                            : resource
                              ? `${resource.type} · ${recordLabel(resource.name, resource.registration_code || resource.resource_id)}`
                              : leg.transport_resource_id
                                ? 'Asset mapping unavailable'
                                : 'No asset assigned'}
                        </span>
                      </td>
                      <td>
                        <div className="transport-route">
                          <span className="orig">{stationLabelByReference(leg.origin, stations, 'origin')}</span>
                          <span className="arr">→</span>
                          <span className="dest">{stationLabelByReference(leg.destination, stations, 'destination')}</span>
                        </div>
                      </td>
                      <td>
                        {leg.mode ? (
                          <span className="transport-mode-chip">{leg.mode}</span>
                        ) : (
                          <span className="op-cell-secondary">Not provided</span>
                        )}
                      </td>
                      <td><StatusPill status={leg.status} /></td>
                      <td>
                        <span className="op-cell-mono" style={{ fontSize: '10px' }}>
                          {leg.planned_departure && !Number.isNaN(Date.parse(leg.planned_departure))
                            ? formatDateTime(leg.planned_departure, true)
                            : <span className="op-cell-secondary">Not provided</span>}
                        </span>
                      </td>
                      <td>
                        <span className="op-cell-mono" style={{ fontSize: '10px' }}>
                          {leg.planned_arrival && !Number.isNaN(Date.parse(leg.planned_arrival))
                            ? formatDateTime(leg.planned_arrival, true)
                            : <span className="op-cell-secondary">Not provided</span>}
                        </span>
                      </td>
                      <td>
                        <span className="op-cell-secondary">
                          {dataErrors['/cargo-items']
                            ? 'Cargo unavailable'
                            : cargo.length
                              ? `${cargo.length} item${cargo.length !== 1 ? 's' : ''}`
                              : 'None linked'}
                        </span>
                        {names.length > 0 && (
                          <span className="op-cell-secondary">{names.length} personnel</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group">
                          <button type="button" className="btn-secondary-sm" disabled={impactLoading} onClick={() => void onViewImpact(leg.leg_id)}>Impact</button>
                          {(leg.status || '').toLowerCase() === 'planned' && (
                            <button type="button" className="btn-danger-sm" disabled={cancelingLegId === leg.leg_id} onClick={() => void onCancelLeg(leg.leg_id)}>
                              {cancelingLegId === leg.leg_id ? 'Requesting…' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

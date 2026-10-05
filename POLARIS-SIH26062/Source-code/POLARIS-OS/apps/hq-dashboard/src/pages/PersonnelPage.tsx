import { useEffect, useMemo, useState } from 'react'
import type { Expedition, Personnel, PersonnelAssignment, Station, TransportLeg, TransportResource } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { formatDate, recordLabel, stationLabelById, transportLabelById } from '../utils/display'

type Props = {
  personnel: Personnel[]
  personnelError?: string
  assignmentsError?: string
  assignments: PersonnelAssignment[]
  stations: Station[]
  expeditions: Expedition[]
  transportLegs: TransportLeg[]
  resources: TransportResource[]
}

const activeAssignment = (assignment: PersonnelAssignment) => {
  const status = (assignment.status || '').toLowerCase().replaceAll('-', '_')
  const terminal = ['completed', 'cancelled', 'unassigned']
  const end = assignment.end_date ? new Date(assignment.end_date) : null
  const ended = !!end && !Number.isNaN(end.getTime()) && end.getTime() < new Date(new Date().toDateString()).getTime()
  return !terminal.includes(status) && !ended
}

export function PersonnelPage({ personnel, personnelError, assignmentsError, assignments, stations, expeditions, transportLegs, resources }: Props) {
  const [tab, setTab] = useState<'roster' | 'assignments'>('roster')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const id = sessionStorage.getItem('polaris_api_person_focus')
    if (id) {
      document.getElementById(`api-person-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      sessionStorage.removeItem('polaris_api_person_focus')
    }
  }, [])

  const activeByPerson = useMemo(() => {
    const map = new Map<string, PersonnelAssignment[]>()
    assignments.filter(activeAssignment).forEach(a => {
      if (!a.personnel_id) return
      map.set(a.personnel_id, [...(map.get(a.personnel_id) ?? []), a])
    })
    return map
  }, [assignments])

  const personById = (personnelId?: string | null) =>
    personnel.find(p => p.person_id === personnelId || p.personnel_id === personnelId)

  const operationLabel = (id?: string | null) => {
    if (!id) return 'No active operation'
    const op = expeditions.find(e => e.expedition_id === id)
    return op ? recordLabel(op.code || op.name, op.expedition_id) : 'Operation mapping unavailable'
  }

  const assetLabel = (legId?: string | null) => {
    if (!legId) return 'No asset assigned'
    const leg = transportLegs.find(l => l.leg_id === legId)
    if (!leg?.transport_resource_id) return 'Asset mapping unavailable'
    const resource = resources.find(r => r.resource_id === leg.transport_resource_id)
    return resource ? recordLabel(resource.name, resource.registration_code || resource.resource_id) : 'Asset mapping unavailable'
  }

  const filteredPersonnel = useMemo(() => {
    if (!query) return personnel
    const q = query.toLowerCase()
    return personnel.filter(p => {
      const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(' ')
      return name.toLowerCase().includes(q) ||
        (p.employee_code ?? '').toLowerCase().includes(q) ||
        (p.role || p.role_on_expedition || '').toLowerCase().includes(q)
    })
  }, [personnel, query])

  const kpi = useMemo(() => {
    const total = personnel.length
    const assigned = new Set(assignments.filter(activeAssignment).map(a => a.personnel_id).filter(Boolean)).size
    const available = total - assigned
    const totalAssignments = assignments.length
    const activeAssignments = assignments.filter(activeAssignment).length
    return { total, assigned, available, totalAssignments, activeAssignments }
  }, [personnel, assignments])

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="op-page-header">
        <div className="op-page-header-left">
          <p className="op-page-eyebrow">
            PERSONNEL OPERATIONS
            <span className="prov-chip api">API</span>
          </p>
          <h1 className="op-page-title">Personnel</h1>
          <p className="op-page-desc">Personnel assignments and operational availability. Station and operation references are joined through assignment and transport records.</p>
        </div>
        <div className="op-page-header-right">
          {personnelError && <span className="prov-chip unavail">DATA UNAVAILABLE</span>}
        </div>
      </div>

      {/* KPI STRIP */}
      {!personnelError && (
        <div className="op-kpi-strip">
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Total</span>
            <span className="op-kpi-value">{kpi.total}</span>
            <span className="op-kpi-sub">personnel records</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Assigned</span>
            <span className="op-kpi-value kpi-success">{kpi.assigned}</span>
            <span className="op-kpi-sub">with active assignment</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Unassigned</span>
            <span className="op-kpi-value">{kpi.available}</span>
            <span className="op-kpi-sub">no active assignment</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Assignments</span>
            <span className="op-kpi-value">{kpi.totalAssignments}</span>
            <span className="op-kpi-sub">{kpi.activeAssignments} active</span>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      {!personnelError && (
        <div className="op-filter-bar">
          <div className="btn-group">
            <button
              type="button"
              className={tab === 'roster' ? 'btn-primary-sm' : 'btn-secondary-sm'}
              onClick={() => setTab('roster')}
            >Personnel roster</button>
            <button
              type="button"
              className={tab === 'assignments' ? 'btn-primary-sm' : 'btn-secondary-sm'}
              onClick={() => setTab('assignments')}
            >Assignment records</button>
          </div>
          <div className="op-filter-sep" />
          {tab === 'roster' && (
            <input
              className="text-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Name, employee ID, role…"
              aria-label="Search personnel"
            />
          )}
        </div>
      )}

      {/* PERSONNEL ROSTER */}
      {tab === 'roster' && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">PERSONNEL · API</p>
              <h2>{personnelError ? 'Personnel data unavailable' : `Personnel (${filteredPersonnel.length})`}</h2>
            </div>
          </div>

          {personnelError ? (
            <div className="panel-body">
              <div className="unavailable-state operational-error" role="alert">
                <strong>PERSONNEL DATA UNAVAILABLE</strong>
                <p>Unable to retrieve personnel records from the API.</p>
                <button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new Event('polaris:refresh'))}>Retry</button>
                <details><summary>Technical details</summary>{personnelError}</details>
              </div>
            </div>
          ) : filteredPersonnel.length === 0 ? (
            <div className="panel-body">
              <div className="op-empty-state">
                <div className="op-empty-icon">👤</div>
                <p className="op-empty-title">NO PERSONNEL RECORDS</p>
                <p className="op-empty-desc">
                  {query ? 'No personnel match this search.' : 'No personnel records returned by the API.'}
                </p>
                <span className="op-empty-source">SOURCE: API</span>
              </div>
            </div>
          ) : (
            <div className="op-table-wrap">
              <table className="op-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Base / station</th>
                    <th>Fitness</th>
                    <th>Active operation</th>
                    <th>Asset</th>
                    <th>Assignment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonnel.map(person => {
                    const id = person.person_id || person.personnel_id || 'unresolved'
                    const name = recordLabel(person.name || [person.first_name, person.last_name].filter(Boolean).join(' '), person.employee_code || id, 'Personnel identity unavailable')
                    const linked = activeByPerson.get(person.person_id) ?? activeByPerson.get(person.personnel_id || '') ?? []
                    const stationId = person.assigned_station_id || person.primary_station_id
                    const assignmentSummary = linked.map(a => `${formatStatusLabel(a.status)} · ${formatDate(a.start_date)} – ${a.end_date ? formatDate(a.end_date) : 'Current'}`).join('; ')
                    return (
                      <tr id={`api-person-${id}`} key={id}>
                        <td>
                          <span className="op-cell-primary">{name}</span>
                          <span className="op-cell-mono">{person.employee_code || 'ID not provided'}</span>
                        </td>
                        <td>
                          <span className="op-cell-secondary">{person.role_on_expedition || person.role || 'Not provided'}</span>
                        </td>
                        <td>
                          <span className="op-cell-secondary">{stationLabelById(stationId, stations)}</span>
                        </td>
                        <td>
                          {person.fitness_status
                            ? <StatusPill status={person.fitness_status} />
                            : <span className="op-cell-secondary">Not provided</span>}
                        </td>
                        <td>
                          <span className="op-cell-secondary">
                            {assignmentsError ? 'Data unavailable' : linked.length ? [...new Set(linked.map(a => operationLabel(a.expedition_id)))].join(', ') : 'No active operation'}
                          </span>
                        </td>
                        <td>
                          <span className="op-cell-secondary">
                            {assignmentsError ? 'Data unavailable' : linked.length ? [...new Set(linked.map(a => assetLabel(a.leg_id)))].join(', ') : 'None assigned'}
                          </span>
                        </td>
                        <td>
                          {assignmentsError
                            ? <span className="op-cell-secondary">Data unavailable</span>
                            : assignmentSummary
                              ? <span className="op-cell-secondary">{assignmentSummary}</span>
                              : <><StatusPill status={person.status} /><span className="op-cell-secondary">No active assignment</span></>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ASSIGNMENTS */}
      {tab === 'assignments' && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">ASSIGNMENT RECORDS · API</p>
              <h2>Assignments ({assignments.length})</h2>
            </div>
          </div>

          {assignmentsError ? (
            <div className="panel-body">
              <div className="unavailable-state operational-error" role="alert">
                <strong>ASSIGNMENT DATA UNAVAILABLE</strong>
                <p>Unable to retrieve personnel assignments from the API.</p>
                <button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new Event('polaris:refresh'))}>Retry</button>
                <details><summary>Technical details</summary>{assignmentsError}</details>
              </div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="panel-body">
              <EmptyState compact message="No assignment records returned by the API." />
            </div>
          ) : (
            <div className="op-table-wrap">
              <table className="op-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Expedition</th>
                    <th>Station</th>
                    <th>Transport leg</th>
                    <th>Asset</th>
                    <th>Status</th>
                    <th>Period</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(assignment => {
                    const person = personById(assignment.personnel_id)
                    const expedition = expeditions.find(e => e.expedition_id === assignment.expedition_id)
                    const leg = transportLegs.find(l => l.leg_id === assignment.leg_id)
                    const resource = resources.find(r => r.resource_id === leg?.transport_resource_id)
                    const personName = person
                      ? recordLabel(person.name || [person.first_name, person.last_name].filter(Boolean).join(' '), person.employee_code || person.person_id || person.personnel_id, 'Personnel identity unavailable')
                      : 'Personnel mapping unavailable'
                    const expeditionName = expedition
                      ? recordLabel(expedition.code || expedition.name, expedition.expedition_id)
                      : assignment.expedition_id ? 'Expedition mapping unavailable' : 'Not assigned'
                    const assetName = leg
                      ? resource ? recordLabel(resource.name, resource.registration_code || resource.resource_id) : 'Asset mapping unavailable'
                      : 'No asset assigned'
                    const isActive = activeAssignment(assignment)
                    return (
                      <tr key={assignment.assignment_id} className={isActive ? '' : ''}>
                        <td>
                          <span className="op-cell-primary">{personName}</span>
                          {!person && <span className="op-cell-secondary">Not in personnel API response</span>}
                        </td>
                        <td><span className="op-cell-secondary">{expeditionName}</span></td>
                        <td><span className="op-cell-secondary">{stationLabelById(assignment.station_id, stations)}</span></td>
                        <td><span className="op-cell-mono">{transportLabelById(assignment.leg_id, transportLegs)}</span></td>
                        <td><span className="op-cell-secondary">{assetName}</span></td>
                        <td><StatusPill status={assignment.status} /></td>
                        <td>
                          <span className="op-cell-mono" style={{ fontSize: '10px' }}>
                            {formatDate(assignment.start_date)} – {assignment.end_date ? formatDate(assignment.end_date) : 'Current'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

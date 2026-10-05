import { useMemo, useState } from 'react'
import type { CargoItem, Expedition, Incident, InventoryStock, Personnel, PersonnelAssignment, Recommendation, Station, TransportLeg, TransportResource } from '../types'
import { EmptyState } from '../components/common/EmptyState'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { formatDate, recordLabel, stationLabelById } from '../utils/display'

type Props = {
  expeditions: Expedition[]
  expeditionsError?: string
  personnel: Personnel[]
  personnelError?: string
  assignments: PersonnelAssignment[]
  assignmentsError?: string
  transportLegs: TransportLeg[]
  transportError?: string
  resources: TransportResource[]
  resourcesError?: string
  cargoItems: CargoItem[]
  cargoError?: string
  inventoryStocks: InventoryStock[]
  inventoryError?: string
  incidents: Incident[]
  incidentsError?: string
  stations: Station[]
  recommendations: Recommendation[]
  recommendationsError?: string
  onNavigate: (route: string) => void
}

const quantity = (value?: number | string | null) => {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const displayCount = (value: number | null, error?: string) =>
  error ? 'Unavailable' : value == null ? 'Not provided' : String(value)

export function OperationalDecisionSupportPage(props: Props) {
  const [selectedId, setSelectedId] = useState('')
  const operation = props.expeditions.find((item) => item.expedition_id === selectedId) ?? props.expeditions[0]

  const linked = useMemo(() => {
    if (!operation) {
      return {
        assignments: [] as PersonnelAssignment[],
        legs: [] as TransportLeg[],
        cargo: [] as CargoItem[],
        incidents: [] as Incident[],
        stations: [] as string[],
      }
    }
    const legs = props.transportLegs.filter((leg) => leg.expedition_id === operation.expedition_id)
    const legIds = new Set(legs.map((leg) => leg.leg_id))
    const assignments = props.assignments.filter((assignment) => assignment.expedition_id === operation.expedition_id)
    const stationIds = [
      ...new Set([
        ...assignments.map((assignment) => assignment.station_id),
        ...props.personnel
          .filter((person) => assignments.some((assignment) => assignment.personnel_id === person.person_id))
          .map((person) => person.assigned_station_id || person.primary_station_id),
      ].filter((id): id is string => Boolean(id))),
    ]
    const cargo = props.cargoItems.filter((item) => Boolean(item.leg_id) && legIds.has(item.leg_id!))
    const incidents = props.incidents.filter(
      (incident) =>
        (Boolean(incident.leg_id) && legIds.has(incident.leg_id!)) ||
        (Boolean(incident.station_id) && stationIds.includes(incident.station_id!)),
    )
    return { assignments, legs, cargo, incidents, stations: stationIds }
  }, [operation, props.assignments, props.cargoItems, props.incidents, props.personnel, props.transportLegs])

  const relevantRecommendations = useMemo(() => {
    if (!operation) return []
    return props.recommendations.filter((recommendation) => {
      return (
        recommendation.trigger_id === operation.expedition_id ||
        linked.legs.some((leg) => leg.leg_id === recommendation.trigger_id) ||
        linked.incidents.some((incident) => incident.incident_id === recommendation.trigger_id)
      )
    })
  }, [linked.incidents, linked.legs, operation, props.recommendations])

  const shipCargo = linked.cargo.filter((item) =>
    (linked.legs.find((leg) => leg.leg_id === item.leg_id)?.mode || '').toLowerCase().includes('ship'),
  )
  const airCargo = linked.cargo.filter((item) =>
    (linked.legs.find((leg) => leg.leg_id === item.leg_id)?.mode || '').toLowerCase().includes('air'),
  )

  const sumWeight = (items: CargoItem[]) =>
    items.reduce<number | null>((total, item) => {
      const value = quantity(item.weight)
      return value == null ? null : total == null ? value : total + value
    }, 0)

  const shipWeight = sumWeight(shipCargo)
  const airWeight = sumWeight(airCargo)

  const resources = linked.legs
    .map((leg) => props.resources.find((resource) => resource.resource_id === leg.transport_resource_id))
    .filter((resource): resource is TransportResource => Boolean(resource))

  const shipResources = linked.legs
    .filter((leg) => (leg.mode || '').toLowerCase().includes('ship'))
    .map((leg) => props.resources.find((resource) => resource.resource_id === leg.transport_resource_id))
    .filter((resource): resource is TransportResource => Boolean(resource))

  const airResources = linked.legs
    .filter((leg) => (leg.mode || '').toLowerCase().includes('air'))
    .map((leg) => props.resources.find((resource) => resource.resource_id === leg.transport_resource_id))
    .filter((resource): resource is TransportResource => Boolean(resource))

  const sumCapacity = (items: TransportResource[]) => {
    const values = items.map((resource) => quantity(resource.max_capacity_weight)).filter((value): value is number => value != null)
    return values.length
      ? `${values.reduce((sum, value) => sum + value, 0).toLocaleString()} kg`
      : props.resourcesError
        ? 'Unavailable'
        : 'Not provided'
  }

  const stockForStations = props.inventoryStocks.filter(
    (stock) => Boolean(stock.station_id) && linked.stations.includes(stock.station_id!),
  )

  const criticalStocks = stockForStations.filter((stock) => {
    const current = quantity(stock.quantity)
    const threshold = quantity(stock.safety_stock_minimum ?? stock.reorder_threshold)
    return current != null && threshold != null && current <= threshold
  }).length

  const openIncidents = linked.incidents.filter(
    (incident) => !['resolved', 'closed'].includes((incident.status || '').toLowerCase()),
  ).length

  const criticalIncidents = linked.incidents.filter(
    (incident) =>
      (incident.severity || '').toLowerCase() === 'critical' &&
      !['resolved', 'closed'].includes((incident.status || '').toLowerCase()),
  ).length

  const peopleCount = props.assignmentsError
    ? null
    : linked.assignments.filter(
        (assignment) => !['cancelled', 'unassigned', 'completed'].includes((assignment.status || '').toLowerCase()),
      ).length

  const operationTitle = operation ? recordLabel(operation.code || operation.name, operation.expedition_id) : ''

  const snapshotCards = [
    {
      title: 'Personnel coverage',
      badge: 'ROSTER',
      rows: [
        ['Linked assignments', displayCount(peopleCount, props.assignmentsError)],
        ['Coverage ratio', 'Governed by assignment records'],
        ['Total assignments', displayCount(props.assignmentsError ? null : linked.assignments.length, props.assignmentsError)],
      ],
    },
    {
      title: 'Ship cargo capacity',
      badge: 'MARITIME',
      rows: [
        ['Manifest items', displayCount(props.cargoError ? null : shipCargo.length, props.cargoError)],
        ['Recorded weight', shipWeight == null ? (props.cargoError ? 'Unavailable' : 'Not recorded') : `${shipWeight.toLocaleString()} kg`],
        ['Linked vessel capacity', sumCapacity(shipResources)],
      ],
    },
    {
      title: 'Air cargo capacity',
      badge: 'AVIATION',
      rows: [
        ['Manifest items', displayCount(props.cargoError ? null : airCargo.length, props.cargoError)],
        ['Recorded weight', airWeight == null ? (props.cargoError ? 'Unavailable' : 'Not recorded') : `${airWeight.toLocaleString()} kg`],
        ['Linked aircraft capacity', sumCapacity(airResources)],
      ],
    },
    {
      title: 'Inventory health',
      badge: 'SUPPLY',
      rows: [
        ['Station stock lines', displayCount(props.inventoryError ? null : stockForStations.length, props.inventoryError)],
        ['Critical / at threshold', displayCount(props.inventoryError ? null : criticalStocks, props.inventoryError)],
        ['Stations linked', linked.stations.length ? linked.stations.map((id) => stationLabelById(id, props.stations)).join(', ') : 'None linked'],
      ],
    },
    {
      title: 'Transport corridors',
      badge: 'TRANSIT',
      rows: [
        ['Linked legs', displayCount(props.transportError ? null : linked.legs.length, props.transportError)],
        ['Assets deployed', displayCount(props.resourcesError ? null : resources.length, props.resourcesError)],
        ['Leg statuses', linked.legs.length ? [...new Set(linked.legs.map((leg) => formatStatusLabel(leg.status)))].join(', ') : 'No legs linked'],
      ],
    },
    {
      title: 'Operational risk',
      badge: 'SAFETY',
      rows: [
        ['Total linked incidents', displayCount(props.incidentsError ? null : linked.incidents.length, props.incidentsError)],
        ['Active open incidents', displayCount(props.incidentsError ? null : openIncidents, props.incidentsError)],
        ['Critical severity', displayCount(props.incidentsError ? null : criticalIncidents, props.incidentsError)],
      ],
    },
  ]

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">DETERMINISTIC LOGISTICS SYNTHESIS</p>
            <span className="provenance-tag live">API SNAPSHOT</span>
          </div>
          <h2>Decision Support Analysis</h2>
          <p className="page-subtitle">
            Cross-domain operational state synthesis: personnel coverage, freight capacities, supply-line risk, and rule-based guidance.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => props.onNavigate('recommendations')}>
            View Recommendations
          </button>
          <button type="button" className="btn-secondary" onClick={() => props.onNavigate('decision-support-demo')}>
            Open Local Rule Engine Demo
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Decision Support Metrics">
        <div className="kpi-card">
          <span className="kpi-label">ACTIVE PERSONNEL</span>
          <span className="kpi-value info">{displayCount(peopleCount, props.assignmentsError)}</span>
          <span className="kpi-hint">Linked active operators</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">TRANSIT LEGS</span>
          <span className="kpi-value">{linked.legs.length}</span>
          <span className="kpi-hint">Sea & overland routes</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">FREIGHT WEIGHT</span>
          <span className="kpi-value">
            {shipWeight != null || airWeight != null
              ? `${((shipWeight || 0) + (airWeight || 0)).toLocaleString()} kg`
              : '—'}
          </span>
          <span className="kpi-hint">Total manifested weight</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">CRITICAL STOCKS</span>
          <span className="kpi-value warning">{criticalStocks}</span>
          <span className="kpi-hint">At or below reorder minimum</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">ACTIVE INCIDENTS</span>
          <span className="kpi-value alert">{openIncidents}</span>
          <span className="kpi-hint">Open route/station risks</span>
        </div>
      </section>

      {props.expeditionsError && (
        <div className="unavailable-state operational-error" role="alert">
          <strong>OPERATION DATA UNAVAILABLE</strong>
          <p>{props.expeditionsError}</p>
          <button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new Event('polaris:refresh'))}>
            Retry
          </button>
        </div>
      )}

      {/* Mission Selector Panel */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="page-title-row">
              <span className="badge-tag">TARGET EXPEDITION</span>
              {operation && <StatusPill status={operation.status} />}
            </div>
            <h3>{operationTitle || 'Select an active expedition'}</h3>
          </div>
          <div className="toolbar-group">
            <label htmlFor="decision-op-select" className="filter-label">
              Select Mission:
            </label>
            <select
              id="decision-op-select"
              className="select-input"
              value={operation?.expedition_id || ''}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={!props.expeditions.length}
            >
              <option value="">Select expedition…</option>
              {props.expeditions.map((item) => (
                <option key={item.expedition_id} value={item.expedition_id}>
                  {item.code || item.name || item.expedition_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {operation && (
          <div className="operation-summary-grid">
            <div>
              <span className="kpi-label">OPERATION</span>
              <strong>{operationTitle}</strong>
            </div>
            <div>
              <span className="kpi-label">START DATE</span>
              <span className="detail-value">{formatDate(operation.planned_start)}</span>
            </div>
            <div>
              <span className="kpi-label">TARGET DEADLINE</span>
              <span className="detail-value">{formatDate(operation.planned_end)}</span>
            </div>
            <div>
              <span className="kpi-label">RECOMMENDATIONS</span>
              <span className="detail-value">
                {props.recommendationsError ? 'Unavailable' : `${relevantRecommendations.length} active`}
              </span>
            </div>
          </div>
        )}
      </section>

      {operation && (
        <>
          {/* Linked Operational Evidence Grid */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">DOMAINS & EVIDENCE</p>
                <h3>Linked Operational Evidence</h3>
              </div>
            </div>
            <div className="ai-signal-grid">
              {snapshotCards.map((card) => (
                <article key={card.title} className="evidence-card">
                  <div className="evidence-header">
                    <span className="badge-tag">{card.badge}</span>
                    <small>{card.title}</small>
                  </div>
                  <dl className="property-list">
                    {card.rows.map(([label, value]) => (
                      <div key={label} className="property-row">
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </section>

          {/* Operational Boundaries */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">DETERMINISTIC CONSTRAINTS</p>
                <h3>Analysis Boundaries &amp; Verification Rules</h3>
              </div>
              <span className="provenance-tag live">DETERMINISTIC MODEL</span>
            </div>
            <div className="panel-body">
              <ul className="rules-bullet-list">
                <li>
                  <strong>Personnel:</strong> Staffing coverage is calculated from persisted assignment and roster records.
                </li>
                <li>
                  <strong>Inventory:</strong> Supply line risk is flagged strictly when station stock is at or below the explicit safety threshold.
                </li>
                <li>
                  <strong>Transport:</strong> Vehicle and vessel capacities are verified against recorded manufacturer limits without synthetic inflation.
                </li>
                <li>
                  <strong>Engine Provenance:</strong> Algorithmic guidance is derived deterministically from operational constraint violations. No ungrounded LLM inference is connected to mission controls.
                </li>
              </ul>
            </div>
          </section>

          {/* Linked Recommendations */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">ACTIVE GUIDANCE</p>
                <h3>
                  {props.recommendationsError
                    ? 'Recommendation data unavailable'
                    : `Linked Recommendations (${relevantRecommendations.length})`}
                </h3>
              </div>
              <button type="button" className="btn-secondary" onClick={() => props.onNavigate('approvals')}>
                Review Approvals Board
              </button>
            </div>
            {props.recommendationsError ? (
              <div className="unavailable-state" role="alert">
                {props.recommendationsError}
              </div>
            ) : relevantRecommendations.length > 0 ? (
              <div className="table-scroll">
                <table className="dense-table" aria-label="Linked Recommendations">
                  <thead>
                    <tr>
                      <th>Recommendation ID / Type</th>
                      <th>Trigger Source</th>
                      <th>Proposed Guidance</th>
                      <th>Constraint Rationale</th>
                      <th>Status</th>
                      <th>Formal Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relevantRecommendations.map((item) => (
                      <tr key={item.recommendation_id}>
                        <td>
                          <div className="cell-primary">
                            <strong>{formatStatusLabel(item.recommendation_type)}</strong>
                            <code className="record-code">{recordLabel(null, item.recommendation_id, 'Rec ID')}</code>
                          </div>
                          <span className="table-subtext">{formatDate(item.generated_at)}</span>
                        </td>
                        <td>
                          <span className="badge-tag">{formatStatusLabel(item.trigger_type)}</span>
                          <span className="table-subtext">{recordLabel(null, item.trigger_id)}</span>
                        </td>
                        <td>
                          <span className="detail-value">
                            {item.proposed_change == null
                              ? 'Not provided'
                              : typeof item.proposed_change === 'string'
                                ? item.proposed_change
                                : JSON.stringify(item.proposed_change)}
                          </span>
                        </td>
                        <td>
                          <span className="text-secondary">{item.constraint_basis || 'Standard operational logic'}</span>
                        </td>
                        <td>
                          <StatusPill status={item.status} />
                        </td>
                        <td>
                          {item.approval_id ? (
                            <span className="authority-note active-note">
                              {recordLabel(null, item.approval_id)}
                            </span>
                          ) : (
                            <span className="text-muted">Unlinked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                compact
                message="No backend recommendations are currently linked to this mission or its transport legs."
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import type { CargoItem, Expedition, Incident, InventoryStock, Personnel, PersonnelAssignment, Station, TransportLeg } from '../types'
import { EmptyState } from '../components/common/EmptyState'
import { StatusPill } from '../components/common/StatusPill'
import { canonicalStationName, stationLabelById } from '../utils/display'
import { DemoBasesPage } from './DemoOperationsPages'

type Props = {
  stations: Station[]
  error?: string
  dataErrors?: Record<string, string>
  personnel: Personnel[]
  assignments: PersonnelAssignment[]
  expeditions: Expedition[]
  legs: TransportLeg[]
  cargo: CargoItem[]
  incidents: Incident[]
  inventory: InventoryStock[]
  onNavigate: (route: string) => void
}

const references = [
  { name: 'NCPOR / Central Operations', key: 'NCPOR', region: 'Goa, India', kind: 'HQ / Central Operations Hub' },
  { name: 'Maitri Research Station', key: 'Maitri', region: 'Schirmacher Oasis, Antarctica', kind: 'Permanent Antarctic Research Base' },
  { name: 'Bharati Research Station', key: 'Bharati', region: 'Larsemann Hills, Antarctica', kind: 'Permanent Antarctic Research Base' },
  { name: 'Himadri Research Station', key: 'Himadri', region: 'Ny-Ålesund, Svalbard, Arctic', kind: 'Arctic Research Facility' },
]

export function BackendBasesPage({
  stations,
  error,
  dataErrors = {},
  personnel,
  assignments,
  expeditions,
  legs,
  cargo,
  incidents,
  inventory,
  onNavigate,
}: Props) {
  const [showDemo, setShowDemo] = useState(false)

  const apiCards = useMemo(() => {
    return references.map((reference) => {
      const station = stations.find((record) => canonicalStationName(record) === reference.key)
      if (!station) {
        return {
          reference,
          station: null as Station | null,
          people: [] as Personnel[],
          assignments: [] as PersonnelAssignment[],
          legs: [] as TransportLeg[],
          cargo: [] as CargoItem[],
          incidents: [] as Incident[],
          inventory: [] as InventoryStock[],
          expeditions: [] as Expedition[],
        }
      }
      const stationPeople = personnel.filter((person) => person.assigned_station_id === station.station_id)
      const stationAssignments = assignments.filter((assignment) => assignment.station_id === station.station_id)
      const stationLegs = legs.filter(
        (leg) =>
          [station.station_id, station.code, station.name].includes(leg.origin ?? '') ||
          [station.station_id, station.code, station.name].includes(leg.destination ?? ''),
      )
      const legIds = new Set(stationLegs.map((leg) => leg.leg_id))
      const stationCargo = cargo.filter((item) => Boolean(item.leg_id) && legIds.has(item.leg_id!))
      const stationIncidents = incidents.filter(
        (incident) => incident.station_id === station.station_id || (Boolean(incident.leg_id) && legIds.has(incident.leg_id!)),
      )
      const stationStocks = inventory.filter((stock) => stock.station_id === station.station_id)
      const expeditionIds = new Set(stationAssignments.map((assignment) => assignment.expedition_id).filter(Boolean))
      const stationExpeditions = expeditions.filter((expedition) => expeditionIds.has(expedition.expedition_id))
      return {
        reference,
        station,
        people: stationPeople,
        assignments: stationAssignments,
        legs: stationLegs,
        cargo: stationCargo,
        incidents: stationIncidents,
        inventory: stationStocks,
        expeditions: stationExpeditions,
      }
    })
  }, [assignments, cargo, expeditions, incidents, inventory, legs, personnel, stations])

  const syntheticStations = useMemo(() => {
    return stations.filter((station) => !canonicalStationName(station))
  }, [stations])

  // Overall KPIs
  const totalStations = stations.length
  const activeStations = stations.filter((s) => (s.status || '').toLowerCase() === 'active').length
  const totalAssignedPeople = personnel.filter((p) => Boolean(p.assigned_station_id)).length
  const totalStationIncidents = incidents.filter((i) => Boolean(i.station_id)).length

  if (showDemo) {
    return (
      <div>
        <div className="page-container" style={{ marginBottom: '1rem' }}>
          <button type="button" className="btn-secondary" onClick={() => setShowDemo(false)}>
            ← Back to Authoritative Station Records
          </button>
        </div>
        <DemoBasesPage onNavigate={onNavigate} />
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">POLAR LOGISTICS NODES & BASES</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>Polar Stations &amp; Research Bases</h2>
          <p className="page-subtitle">
            Strategic operational footprint across Antarctica and the Arctic: active research bases, logistics staging, and communication hubs.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => onNavigate('tracking')}>
            View Unified Map
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowDemo(true)}>
            Open Synthetic Demo
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Station Network Metrics">
        <div className="kpi-card">
          <span className="kpi-label">REGISTERED STATIONS</span>
          <span className="kpi-value">{totalStations}</span>
          <span className="kpi-hint">Authoritative records</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">OPERATIONAL STATUS</span>
          <span className="kpi-value success">{activeStations}</span>
          <span className="kpi-hint">Active stations</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">STATIONED PERSONNEL</span>
          <span className="kpi-value info">{totalAssignedPeople}</span>
          <span className="kpi-hint">Assigned across stations</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">STATION INCIDENTS</span>
          <span className="kpi-value warning">{totalStationIncidents}</span>
          <span className="kpi-hint">Associated incident reports</span>
        </div>
      </section>

      {error && (
        <div className="unavailable-state" role="status">
          Station records unavailable. {error}
          <button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new Event('polaris:refresh'))}>
            Retry
          </button>
        </div>
      )}

      {!error && stations.length === 0 && (
        <EmptyState message="No station records were returned by the API. Reference location details remain available below." />
      )}

      {/* Primary Canonical Stations Grid */}
      {!error && (
        <section className="base-grid">
          {apiCards.map(
            ({
              reference,
              station,
              people,
              assignments: stationAssignments,
              legs: stationLegs,
              cargo: stationCargo,
              incidents: stationIncidents,
              inventory: stationInventory,
              expeditions: stationExpeditions,
            }) =>
              station ? (
                <article className="panel base-card" key={reference.key}>
                  <div className="panel-header">
                    <div>
                      <div className="page-title-row">
                        <span className="provenance-tag live">API</span>
                        <code className="code-badge">{station.code || station.station_id}</code>
                        <span className="text-secondary">{reference.region}</span>
                      </div>
                      <h3>{reference.name}</h3>
                      <p className="page-subtitle">{reference.kind}</p>
                    </div>
                    <div className="header-actions">
                      <StatusPill status={station.status} />
                    </div>
                  </div>

                  {/* Micro KPI grid */}
                  <div className="ai-signal-grid base-metrics">
                    <div>
                      <small>PERSONNEL</small>
                      <strong>{dataErrors['/personnel'] ? '—' : people.length}</strong>
                    </div>
                    <div>
                      <small>ASSIGNMENTS</small>
                      <strong>{dataErrors['/personnel-assignments'] ? '—' : stationAssignments.length}</strong>
                    </div>
                    <div>
                      <small>ROUTES / LEGS</small>
                      <strong>{dataErrors['/transport-legs'] ? '—' : stationLegs.length}</strong>
                    </div>
                    <div>
                      <small>CARGO ITEMS</small>
                      <strong>{dataErrors['/cargo-items'] ? '—' : stationCargo.length}</strong>
                    </div>
                    <div>
                      <small>SUPPLY LINES</small>
                      <strong>{dataErrors['/inventory-stocks'] ? '—' : stationInventory.length}</strong>
                    </div>
                    <div>
                      <small>INCIDENTS</small>
                      <strong>{dataErrors['/incidents'] ? '—' : stationIncidents.length}</strong>
                    </div>
                  </div>

                  <div className="panel-body">
                    {/* Personnel Section */}
                    <div className="base-sub-section">
                      <span className="section-label">ASSIGNED ROSTER</span>
                      {dataErrors['/personnel'] ? (
                        <p className="data-note">Personnel data unavailable from the API.</p>
                      ) : people.length > 0 ? (
                        <ul className="mini-record-list">
                          {people.slice(0, 4).map((p) => (
                            <li key={p.person_id}>
                              <strong>{p.name || p.employee_code || p.person_id}</strong>
                              <span> · {p.role_on_expedition || 'Specialist'} · {p.fitness_status || 'Fit'}</span>
                            </li>
                          ))}
                          {people.length > 4 && <li className="text-muted">+ {people.length - 4} more personnel</li>}
                        </ul>
                      ) : (
                        <p className="data-note">No personnel records currently mapped to this station.</p>
                      )}
                    </div>

                    {/* Expeditions and Transport Legs */}
                    <div className="base-sub-section">
                      <span className="section-label">ACTIVE OPERATIONS & TRANSIT ROUTES</span>
                      {stationExpeditions.length > 0 || stationLegs.length > 0 ? (
                        <ul className="mini-record-list">
                          {stationExpeditions.map((exp) => (
                            <li key={exp.expedition_id}>
                              <span className="badge-tag">MISSION</span>
                              <strong>{exp.code || exp.name}</strong> · {exp.status}
                            </li>
                          ))}
                          {stationLegs.slice(0, 3).map((leg) => (
                            <li key={leg.leg_id}>
                              <span className="mode-tag">{leg.mode || 'Transit'}</span>
                              <span>{leg.origin} → {leg.destination}</span> · <StatusPill status={leg.status} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="data-note">No active expedition or transit legs connected.</p>
                      )}
                    </div>

                    {/* Inventory Snapshot */}
                    <div className="base-sub-section">
                      <span className="section-label">SUPPLY STOCK SNAPSHOT</span>
                      {stationInventory.length > 0 ? (
                        <p className="detail-value">
                          {stationInventory.length} distinct catalog lines logged ({stationInventory.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0).toLocaleString()} units on site).
                        </p>
                      ) : (
                        <p className="data-note">No inventory stocks reported for this station.</p>
                      )}
                    </div>

                    <div className="base-footer">
                      <span className="text-secondary">{stationLabelById(station.station_id, stations)}</span>
                      <button type="button" className="btn-secondary-sm" onClick={() => onNavigate('tracking')}>
                        Focus on Map
                      </button>
                    </div>
                  </div>
                </article>
              ) : (
                <article className="panel base-card base-card-reference" key={reference.key}>
                  <div className="panel-header">
                    <div>
                      <div className="page-title-row">
                        <span className="provenance-tag reference">REFERENCE</span>
                        <span className="text-secondary">{reference.region}</span>
                      </div>
                      <h3>{reference.name}</h3>
                      <p className="page-subtitle">{reference.kind}</p>
                    </div>
                    <span className="provenance-chip provenance-chip--unavailable">UNLINKED</span>
                  </div>
                  <div className="panel-body">
                    <p className="data-note">
                      No matching backend API station record is currently configured for {reference.name}. Station parameters, roster, and telemetry remain unlinked.
                    </p>
                  </div>
                </article>
              ),
          )}
        </section>
      )}

      {/* Synthetic Stations (DEMO) */}
      {!error && syntheticStations.length > 0 && (
        <section className="panel" style={{ marginTop: '1.5rem' }}>
          <div className="panel-header">
            <div>
              <div className="page-title-row">
                <p className="eyebrow">BROWSER / SYNTHETIC TEST RECORDS</p>
                <span className="provenance-tag demo">DEMO / SIMULATED</span>
              </div>
              <h3>Synthetic Station Records ({syntheticStations.length})</h3>
              <p className="page-subtitle">
                Synthetic stations created for testing or simulated scenarios that do not correspond to canonical polar bases.
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="dense-table" aria-label="Synthetic Stations">
              <thead>
                <tr>
                  <th>Provenance</th>
                  <th>Station Name</th>
                  <th>Station Code</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {syntheticStations.map((st) => (
                  <tr key={st.station_id}>
                    <td>
                      <span className="provenance-tag demo">DEMO / SIMULATED</span>
                    </td>
                    <td>
                      <strong>{st.name || 'Synthetic station'}</strong>
                    </td>
                    <td>
                      <code className="record-code">{st.code || st.station_id}</code>
                    </td>
                    <td>
                      <StatusPill status={st.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

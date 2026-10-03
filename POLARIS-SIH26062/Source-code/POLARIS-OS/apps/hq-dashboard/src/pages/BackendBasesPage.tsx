import { useState } from 'react'
import type { CargoItem, Expedition, Incident, InventoryStock, Personnel, PersonnelAssignment, Station, TransportLeg } from '../types'
import { EmptyState } from '../components/common/EmptyState'
import { StatusPill } from '../components/common/StatusPill'
import { canonicalStationName, stationLabelById } from '../utils/display'
import { DemoBasesPage } from './DemoOperationsPages'

type Props = { stations: Station[]; error?: string; personnel: Personnel[]; assignments: PersonnelAssignment[]; expeditions: Expedition[]; legs: TransportLeg[]; cargo: CargoItem[]; incidents: Incident[]; inventory: InventoryStock[]; onNavigate: (route: string) => void }
const references = [
  { name: 'NCPOR / Central Operations', key: 'NCPOR', region: 'Goa, India', kind: 'HQ / Central Operations' },
  { name: 'Maitri', key: 'Maitri', region: 'Antarctica', kind: 'Indian Antarctic research station' },
  { name: 'Bharati', key: 'Bharati', region: 'Antarctica', kind: 'Indian Antarctic research station' },
  { name: 'Himadri', key: 'Himadri', region: 'Svalbard, Arctic', kind: 'Indian Arctic research station' },
]

export function BackendBasesPage({ stations, error, personnel, assignments, expeditions, legs, cargo, incidents, inventory, onNavigate }: Props) {
  const [showDemo, setShowDemo] = useState(false)
  if (showDemo) return <div><div className="page-container"><button type="button" className="btn-secondary" onClick={() => setShowDemo(false)}>Back to station records</button></div><DemoBasesPage onNavigate={onNavigate} /></div>

  const apiCards = references.map((reference) => {
    const station = stations.find((record) => canonicalStationName(record) === reference.key)
    if (!station) return { reference, station: null as Station | null, people: [] as Personnel[], assignments: [] as PersonnelAssignment[], legs: [] as TransportLeg[], cargo: [] as CargoItem[], incidents: [] as Incident[], inventory: [] as InventoryStock[], expeditions: [] as Expedition[] }
    const stationPeople = personnel.filter((person) => person.assigned_station_id === station.station_id)
    const stationAssignments = assignments.filter((assignment) => assignment.station_id === station.station_id)
    const stationLegs = legs.filter((leg) => [station.station_id, station.code, station.name].includes(leg.origin ?? '') || [station.station_id, station.code, station.name].includes(leg.destination ?? ''))
    const legIds = new Set(stationLegs.map((leg) => leg.leg_id))
    const stationCargo = cargo.filter((item) => !!item.leg_id && legIds.has(item.leg_id))
    const stationIncidents = incidents.filter((incident) => incident.station_id === station.station_id || (!!incident.leg_id && legIds.has(incident.leg_id)))
    const stationStocks = inventory.filter((stock) => stock.station_id === station.station_id)
    const expeditionIds = new Set(stationAssignments.map((assignment) => assignment.expedition_id).filter(Boolean))
    const stationExpeditions = expeditions.filter((expedition) => expeditionIds.has(expedition.expedition_id))
    return { reference, station, people: stationPeople, assignments: stationAssignments, legs: stationLegs, cargo: stationCargo, incidents: stationIncidents, inventory: stationStocks, expeditions: stationExpeditions }
  })
  const syntheticStations = stations.filter((station) => !canonicalStationName(station))

  return <div className="page-container">
    <div className="notice-banner"><strong>POLAR STATIONS & BASES</strong> Operational counts use authenticated backend records. Reference entries are separated when no API station record is available.</div>
    {error && <div className="unavailable-state" role="status">Station records unavailable. {error}<button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new Event('polaris:refresh'))}>Retry</button></div>}
    {error ? null : stations.length === 0 ? <EmptyState message="No station records were returned by the API. Reference location details remain available below." /> : null}
    {!error && <div className="base-grid">{apiCards.map(({ reference, station, people, assignments: stationAssignments, legs: stationLegs, cargo: stationCargo, incidents: stationIncidents, inventory: stationInventory, expeditions: stationExpeditions }) => station ? <section className="panel base-card" key={reference.key}>
      <div className="panel-header"><div><p className="eyebrow">API RECORD · {reference.region.toUpperCase()} · {station.code || station.station_id}</p><h2>{reference.name}</h2><small>{reference.kind}</small></div><div className="toolbar-group"><StatusPill status={station.status} /><button type="button" className="btn-secondary-sm" onClick={() => onNavigate('tracking')}>VIEW MAP</button></div></div>
      <div className="ai-signal-grid base-metrics">{[['PERSONNEL', people.length], ['ASSIGNMENTS', stationAssignments.length], ['TRANSPORT LEGS', stationLegs.length], ['CARGO', stationCargo.length], ['INVENTORY LINES', stationInventory.length], ['INCIDENTS', stationIncidents.length]].map(([label, value]) => <div key={label}><small>{label} · API</small><strong>{value}</strong></div>)}</div>
      <div className="panel-body"><strong>Personnel · API</strong>{people.length ? people.map((person) => <p className="data-note" key={person.person_id}>{person.name || person.employee_code || person.person_id} · {person.role_on_expedition || 'Role unavailable'} · {person.fitness_status || 'Fitness unavailable'}</p>) : <p className="data-note">No personnel records identify this current station.</p>}
        <strong>Operations and routes · API</strong>{stationExpeditions.map((expedition) => <p className="data-note" key={expedition.expedition_id}>{expedition.code || expedition.expedition_id} · {expedition.name || 'Name unavailable'} · {expedition.status || 'Status unavailable'}</p>)}{stationLegs.map((leg) => <p className="data-note" key={leg.leg_id}>{leg.code || leg.leg_id} · {leg.origin || 'Origin unavailable'} → {leg.destination || 'Destination unavailable'} · {leg.status || 'Status unavailable'}</p>)}{!stationExpeditions.length && !stationLegs.length && <p className="data-note">No associated expedition or transport records.</p>}
        <strong>Inventory · API</strong>{stationInventory.length ? stationInventory.map((stock) => <p className="data-note" key={stock.stock_id}>{stock.item_name || stock.item_catalog_id || 'Item name unavailable'} · {stock.quantity ?? 'Quantity unavailable'}</p>) : <p className="data-note">No inventory records returned for this station.</p>}
        <strong>Incidents · API ({stationIncidents.length})</strong>{stationIncidents.map((incident) => <p className="data-note" key={incident.incident_id}>{incident.incident_id} · {incident.type || 'Type unavailable'} · {incident.severity || 'Severity unavailable'} · {incident.status || 'Status unavailable'}</p>)}<small>{stationLabelById(station.station_id, stations)}</small>
      </div>
    </section> : <section className="panel base-card" key={reference.key}><div className="panel-header"><div><p className="eyebrow">REFERENCE · {reference.region.toUpperCase()}</p><h2>{reference.name}</h2><small>{reference.kind}</small></div><span className="provenance-chip provenance-chip--unavailable">UNAVAILABLE</span></div><p className="data-note">No matching API station record is currently available. Operational status, personnel, assignments, transport, cargo, inventory, and incidents are unavailable.</p></section>)}</div>}
    {!error && syntheticStations.length > 0 && <section className="panel"><div className="panel-header"><div><p className="eyebrow">DEMO / SIMULATED RECORDS</p><h2>Synthetic station records ({syntheticStations.length})</h2></div></div><p className="data-note">Underlying records are preserved and listed separately because they do not map to canonical polar station names.</p><div className="table-scroll"><table><thead><tr><th>Data source</th><th>Record name</th><th>Code</th><th>Status</th></tr></thead><tbody>{syntheticStations.map((station) => <tr key={station.station_id}><td>DEMO / SIMULATED</td><td>{station.name || 'Synthetic station reference'}</td><td>{station.code || station.station_id}</td><td><StatusPill status={station.status} /></td></tr>)}</tbody></table></div></section>}
    <section className="panel"><div className="panel-body"><button type="button" className="btn-secondary" onClick={() => setShowDemo(true)}>Open synthetic base demo · DEMO</button></div></section>
  </div>
}

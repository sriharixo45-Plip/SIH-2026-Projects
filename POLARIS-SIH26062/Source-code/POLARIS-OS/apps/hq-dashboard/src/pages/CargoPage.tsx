import { useEffect, useMemo, useState } from 'react'
import type { CargoItem, CargoMovementEvent } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiGet } from '../services/api'
import type { TransportLeg } from '../types'
import { recordLabel, transportLabelById, redactDatabaseIds } from '../utils/display'

type CargoPageProps = {
  cargoItems: CargoItem[]
  dataError?: string
  transportLegs: TransportLeg[]
}

export function CargoPage({ cargoItems, dataError, transportLegs }: CargoPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [hazardFilter, setHazardFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null)
  const [movementEvents, setMovementEvents] = useState<CargoMovementEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const filteredItems = useMemo(() => {
    return cargoItems.filter((item) => {
      const query = searchTerm.toLowerCase()
      const matchesQuery = !query ||
        (item.tracking_code ?? '').toLowerCase().includes(query) ||
        (item.description ?? '').toLowerCase().includes(query) ||
        (item.category ?? '').toLowerCase().includes(query)
      const normalizedHazard = String(item.hazard_class ?? '').toLowerCase()
      const matchesHazard = hazardFilter === 'all' || (hazardFilter === 'non-hazardous' ? item.hazard_class == null || normalizedHazard === 'non-hazardous' : normalizedHazard === hazardFilter)
      const matchesStatus = statusFilter === 'all' || (item.status ?? '').toLowerCase() === statusFilter

      return matchesQuery && matchesHazard && matchesStatus
    })
  }, [cargoItems, hazardFilter, searchTerm, statusFilter])

  const selectedCargo = filteredItems.find((item) => item.cargo_id === selectedCargoId) ?? filteredItems[0] ?? null

  useEffect(() => {
    if (!selectedCargo?.cargo_id) {
      setMovementEvents([])
      return
    }

    let isMounted = true
    setLoadingEvents(true)
    setEventsError(null)

    apiGet<CargoMovementEvent[]>(`/cargo-movement-events/${selectedCargo.cargo_id}`)
      .then((data) => {
        if (isMounted) setMovementEvents(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (isMounted) { setMovementEvents([]); setEventsError('Movement history unavailable from the API.') }
      })
      .finally(() => {
        if (isMounted) setLoadingEvents(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedCargo?.cargo_id])

  return (
    <div className="page-container cargo-dashboard">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">CARGO MANAGEMENT & TRACEABILITY</p>
            <h3>{dataError ? 'Cargo data unavailable' : `Expedition cargo inventory (${filteredItems.length})`}</h3>
          </div>

          <div className="toolbar-group cargo-filters">
            <input
              type="text"
              className="text-input"
              aria-label="Search cargo tracking code, description, or category"
              placeholder="Filter code, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select aria-label="Filter by hazard class" className="select-input" value={hazardFilter} onChange={(e) => setHazardFilter(e.target.value)}>
              <option value="all">All hazards</option>
              <option value="non-hazardous">Non-hazardous</option>
              <option value="1">Class 1</option>
              <option value="2">Class 2</option>
              <option value="3">Class 3</option>
            </select>
            <select aria-label="Filter by cargo status" className="select-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All status</option>
              <option value="packed">Packed</option>
              <option value="in_transit">In transit</option>
              <option value="delivered">Delivered</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
        </div>

        <div className="panel-body cargo-panel-body">
          {dataError ? <div className="unavailable-state" role="status">Cargo data unavailable. {dataError}</div> : filteredItems.length === 0 ? (
            <EmptyState message="No cargo items found matching the current search criteria." />
          ) : (
            <>
              <div className="table-scroll cargo-table-scroll">
                <table className="cargo-table">
                  <thead><tr><th scope="col">Tracking</th><th scope="col">Description</th><th scope="col">Status</th><th scope="col">Hazard</th></tr></thead>
                  <tbody>
                    {filteredItems.map((cargo) => (
                      <tr key={cargo.cargo_id} className={selectedCargo?.cargo_id === cargo.cargo_id ? 'cargo-table-row selected' : 'cargo-table-row'} aria-selected={selectedCargo?.cargo_id === cargo.cargo_id}>
                        <td><button type="button" className="cargo-select" aria-pressed={selectedCargo?.cargo_id === cargo.cargo_id} aria-label={`Show details for ${recordLabel(cargo.tracking_code, cargo.cargo_id)}`} onClick={() => setSelectedCargoId(cargo.cargo_id)}><span className="mono-code">{recordLabel(cargo.tracking_code, cargo.cargo_id)}</span></button></td>
                        <td><strong className="cargo-description">{redactDatabaseIds(cargo.description ?? 'Description not provided')}</strong></td>
                        <td><StatusPill status={cargo.status} /></td>
                        <td><span className={`hazard-badge ${cargo.hazard_class != null ? 'hazard-active' : 'hazard-none'}`}>{cargo.hazard_class != null ? `CLASS ${cargo.hazard_class}` : 'Hazard not provided'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {selectedCargo && !dataError && filteredItems.length > 0 ? (
        <section className="panel cargo-detail-card" aria-labelledby="cargo-detail-title">
          <div className="panel-header cargo-detail-header">
            <div><p className="eyebrow">CARGO DETAIL</p><h2 id="cargo-detail-title">{redactDatabaseIds(selectedCargo.description ?? 'Description not provided')}</h2></div>
            <StatusPill status={selectedCargo.status} />
          </div>
          <div className="panel-body cargo-detail-body">
            <dl className="cargo-detail-grid">
              <div className="cargo-detail-field"><dt>Tracking</dt><dd className="mono-code">{recordLabel(selectedCargo.tracking_code, selectedCargo.cargo_id)}</dd></div>
              <div className="cargo-detail-field"><dt>Status</dt><dd><StatusPill status={selectedCargo.status} /></dd></div>
              <div className="cargo-detail-field"><dt>Category</dt><dd>{selectedCargo.category ? formatStatusLabel(selectedCargo.category) : 'Not provided'}</dd></div>
              <div className="cargo-detail-field"><dt>Weight</dt><dd>{selectedCargo.weight != null ? `${selectedCargo.weight} kg` : 'Not provided'}</dd></div>
              <div className="cargo-detail-field"><dt>Hazard</dt><dd>{selectedCargo.hazard_class != null ? `CLASS ${selectedCargo.hazard_class}` : 'Not provided'}</dd></div>
              <div className="cargo-detail-field"><dt>Transport leg</dt><dd className="mono-code">{selectedCargo.leg_id ? transportLabelById(selectedCargo.leg_id, transportLegs) : 'Transport unavailable'}</dd></div>
            </dl>
            <section className="cargo-movement" aria-labelledby="cargo-movement-title">
              <h3 id="cargo-movement-title">Movement history</h3>
              {loadingEvents ? <p className="cargo-empty-history" role="status">Loading events…</p> : eventsError ? <p className="cargo-empty-history" role="status">{eventsError}</p> : movementEvents.length === 0 ? <p className="cargo-empty-history">No movement events logged for this item.</p> : (
                <ul className="cargo-movement-list">{movementEvents.map((evt) => <li key={evt.event_id}><time dateTime={evt.timestamp_utc}>{new Date(evt.timestamp_utc).toLocaleDateString()}</time><strong>{formatStatusLabel(evt.event_type)}{evt.reason ? `: ${evt.reason}` : ''}</strong></li>)}</ul>
              )}
            </section>
          </div>
        </section>
      ) : null}
    </div>
  )
}

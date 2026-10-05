import { useEffect, useMemo, useState } from 'react'
import type { CargoItem, CargoMovementEvent, Expedition, Station, TransportResource, TransportLeg } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiGet, apiPatch, ApiError } from '../services/api'
import { formatDateTime, isDatabaseId, recordLabel, stationLabelById, redactDatabaseIds } from '../utils/display'

type CargoPageProps = {
  cargoItems: CargoItem[]
  dataError?: string
  transportLegs: TransportLeg[]
  resources?: TransportResource[]
  expeditions?: Expedition[]
  stations?: Station[]
  pageTitle?: string
  currentUserId?: string
  onRefresh?: () => void
}

const cargoTransitions: Record<string, string[]> = {
  packed: ['in_transit', 'in_storage_at_station', 'damaged', 'returned'],
  in_transit: ['in_storage_at_station', 'delivered', 'damaged', 'returned'],
  in_storage_at_station: ['delivered', 'damaged', 'returned'],
  delivered: ['returned'],
  damaged: ['returned'],
  returned: [],
}

const cargoTransitionOptions = (status?: string | null) =>
  cargoTransitions[(status ?? '').toLowerCase().replaceAll('-', '_')] ?? []

export function CargoPage({
  cargoItems,
  dataError,
  transportLegs,
  resources = [],
  expeditions = [],
  stations = [],
  pageTitle = 'Cargo Manifest',
  currentUserId,
  onRefresh,
}: CargoPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [hazardFilter, setHazardFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null)
  const [movementEvents, setMovementEvents] = useState<CargoMovementEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState('')
  const [statusNotice, setStatusNotice] = useState('')
  const [updatingCargoId, setUpdatingCargoId] = useState<string | null>(null)

  const updateStatus = async (cargo: CargoItem, status: string) => {
    if (!currentUserId) {
      setStatusError('Authenticated user identity is unavailable.')
      return
    }
    setUpdatingCargoId(cargo.cargo_id)
    setStatusError('')
    setStatusNotice('')
    try {
      await apiPatch(`/cargo-items/${cargo.cargo_id}/status`, { status, actor: currentUserId })
      setStatusNotice(`Cargo ${cargo.tracking_code || cargo.cargo_id} status saved to ${formatStatusLabel(status)}.`)
      onRefresh?.()
    } catch (cause) {
      setStatusError(
        cause instanceof ApiError && cause.status === 403
          ? 'The server denied this cargo status change.'
          : cause instanceof Error
            ? cause.message
            : 'Cargo status could not be saved.',
      )
    } finally {
      setUpdatingCargoId(null)
    }
  }

  const filteredItems = useMemo(() => {
    return cargoItems.filter((item) => {
      const query = searchTerm.toLowerCase()
      const matchesQuery =
        !query ||
        (item.tracking_code ?? '').toLowerCase().includes(query) ||
        (item.description ?? '').toLowerCase().includes(query) ||
        (item.category ?? '').toLowerCase().includes(query)

      const normalizedHazard = String(item.hazard_class ?? '').toLowerCase()
      const matchesHazard =
        hazardFilter === 'all' ||
        (hazardFilter === 'non-hazardous'
          ? item.hazard_class == null || normalizedHazard === 'non-hazardous'
          : normalizedHazard === hazardFilter)

      const matchesStatus =
        statusFilter === 'all' ||
        (item.status ?? '').toLowerCase().replaceAll('-', '_') === statusFilter

      return matchesQuery && matchesHazard && matchesStatus
    })
  }, [cargoItems, hazardFilter, searchTerm, statusFilter])

  const selectedCargo = filteredItems.find((item) => item.cargo_id === selectedCargoId) ?? filteredItems[0] ?? null
  const selectedLeg = selectedCargo?.leg_id
    ? transportLegs.find((leg) => leg.leg_id === selectedCargo.leg_id)
    : undefined
  const selectedResource = selectedLeg?.transport_resource_id
    ? resources.find((resource) => resource.resource_id === selectedLeg.transport_resource_id)
    : undefined
  const selectedExpedition = selectedLeg?.expedition_id
    ? expeditions.find((expedition) => expedition.expedition_id === selectedLeg.expedition_id)
    : undefined

  const locationLabel = (reference?: string | null) => {
    if (!reference) return 'Not provided'
    const station = stations.find(
      (item) =>
        item.station_id === reference ||
        item.code?.toLowerCase() === reference.toLowerCase() ||
        item.name?.toLowerCase() === reference.toLowerCase(),
    )
    if (station) return stationLabelById(station.station_id, stations)
    return isDatabaseId(reference) ? 'Location unmapped' : reference
  }

  // Load movement events
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
        if (isMounted) {
          setMovementEvents([])
          setEventsError('Movement history unavailable from the API.')
        }
      })
      .finally(() => {
        if (isMounted) setLoadingEvents(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedCargo?.cargo_id])

  // KPIs
  const kpis = useMemo(() => {
    const total = cargoItems.length
    const inTransit = cargoItems.filter(
      (c) => (c.status ?? '').toLowerCase().replaceAll('-', '_') === 'in_transit',
    ).length
    const staged = cargoItems.filter(
      (c) => ['packed', 'in_storage_at_station'].includes((c.status ?? '').toLowerCase().replaceAll('-', '_')),
    ).length
    const delivered = cargoItems.filter(
      (c) => (c.status ?? '').toLowerCase() === 'delivered',
    ).length
    const hazardous = cargoItems.filter((c) => c.hazard_class != null && String(c.hazard_class) !== 'non-hazardous').length
    return { total, inTransit, staged, delivered, hazardous }
  }, [cargoItems])

  return (
    <div className="page-container cargo-page-layout">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">POLAR LOGISTICS & FREIGHT</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>{pageTitle}</h2>
          <p className="page-subtitle">
            Cargo manifests, freight tracking, hazard classification, and multi-modal transit legs across Antarctic stations.
          </p>
        </div>
        <div className="header-actions">
          {onRefresh && (
            <button type="button" className="btn-secondary" onClick={() => onRefresh()}>
              Refresh Manifest
            </button>
          )}
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Cargo Metrics">
        <div className="kpi-card">
          <span className="kpi-label">TOTAL ITEMS</span>
          <span className="kpi-value">{kpis.total}</span>
          <span className="kpi-hint">Manifest entries</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">IN TRANSIT</span>
          <span className="kpi-value info">{kpis.inTransit}</span>
          <span className="kpi-hint">Active overland/air/sea legs</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">STAGED / STORAGE</span>
          <span className="kpi-value warning">{kpis.staged}</span>
          <span className="kpi-hint">Station holding & packed</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">DELIVERED</span>
          <span className="kpi-value success">{kpis.delivered}</span>
          <span className="kpi-hint">Completed delivery</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">HAZARDOUS</span>
          <span className="kpi-value alert">{kpis.hazardous}</span>
          <span className="kpi-hint">Class 1-3 controlled</span>
        </div>
      </section>

      {statusError && (
        <div className="error-banner" role="alert">
          {statusError}
        </div>
      )}
      {statusNotice && (
        <div className="notice-banner" role="status">
          {statusNotice}
        </div>
      )}

      {/* Main Content Area */}
      <section className="panel">
        {/* Toolbar */}
        <div className="operational-toolbar">
          <div className="filter-group">
            <label htmlFor="cargo-search" className="sr-only">
              Search cargo
            </label>
            <input
              id="cargo-search"
              type="search"
              className="text-input filter-search"
              placeholder="Search code, item description, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="hazard-select" className="filter-label">
              Hazard:
            </label>
            <select
              id="hazard-select"
              className="select-input"
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
            >
              <option value="all">All hazard classes</option>
              <option value="non-hazardous">Non-hazardous</option>
              <option value="1">Class 1 (Explosives/Fuel)</option>
              <option value="2">Class 2 (Gases)</option>
              <option value="3">Class 3 (Flammable Liquids)</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="status-select" className="filter-label">
              Status:
            </label>
            <select
              id="status-select"
              className="select-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="packed">Packed</option>
              <option value="in_transit">In Transit</option>
              <option value="in_storage_at_station">In Storage</option>
              <option value="delivered">Delivered</option>
              <option value="damaged">Damaged</option>
              <option value="returned">Returned</option>
            </select>
          </div>
        </div>

        {dataError ? (
          <div className="unavailable-state" role="status">
            Cargo data unavailable. {dataError}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            message={
              cargoItems.length === 0
                ? 'No cargo manifest records returned by the API.'
                : 'No cargo items match the active search and filter criteria.'
            }
          />
        ) : (
          <div className={`table-drawer-layout ${selectedCargo ? 'with-drawer' : ''}`}>
            {/* Table */}
            <div className="table-scroll">
              <table className="dense-table" aria-label="Cargo Manifest Records">
                <thead>
                  <tr>
                    <th>Tracking / Code</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Transport Leg</th>
                    <th>Weight</th>
                    <th>Hazard</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((cargo) => {
                    const isSelected = selectedCargo?.cargo_id === cargo.cargo_id
                    const leg = cargo.leg_id ? transportLegs.find((l) => l.leg_id === cargo.leg_id) : undefined
                    const transitions = cargoTransitionOptions(cargo.status)

                    return (
                      <tr
                        key={cargo.cargo_id}
                        className={`table-row-selectable ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedCargoId(cargo.cargo_id)}
                      >
                        <td>
                          <code className="record-code">{recordLabel(cargo.tracking_code, cargo.cargo_id)}</code>
                        </td>
                        <td>
                          <div className="cell-primary">
                            <strong className="cargo-item-name">{redactDatabaseIds(cargo.description ?? 'Unlabeled cargo')}</strong>
                            {cargo.is_return_cargo && <span className="badge-tag warning">RETURN CARGO</span>}
                          </div>
                        </td>
                        <td>
                          <span className="text-secondary">{cargo.category ? formatStatusLabel(cargo.category) : 'General'}</span>
                        </td>
                        <td>
                          {leg ? (
                            <span className="route-inline">
                              <span className="mode-tag">{leg.mode || 'Transit'}</span>
                              <span className="route-arrow">{locationLabel(leg.origin)} → {locationLabel(leg.destination)}</span>
                            </span>
                          ) : (
                            <span className="text-muted">Unassigned</span>
                          )}
                        </td>
                        <td className="text-right">
                          {cargo.weight != null ? (
                            <span className="metric-num">{cargo.weight.toLocaleString()} kg</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {cargo.hazard_class != null ? (
                            <span className="hazard-chip active">CLASS {cargo.hazard_class}</span>
                          ) : (
                            <span className="hazard-chip">NONE</span>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="status-action-row">
                            <StatusPill status={cargo.status} />
                            {transitions.length > 0 && (
                              <select
                                className="select-input input-compact"
                                aria-label={`Change status for ${cargo.tracking_code || cargo.cargo_id}`}
                                value=""
                                disabled={updatingCargoId === cargo.cargo_id}
                                onChange={(e) => {
                                  if (e.target.value) void updateStatus(cargo, e.target.value)
                                }}
                              >
                                <option value="">{updatingCargoId === cargo.cargo_id ? 'Saving…' : 'Update…'}</option>
                                {transitions.map((st) => (
                                  <option key={st} value={st}>
                                    → {formatStatusLabel(st)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected Cargo Detail Drawer */}
            {selectedCargo && (
              <aside className="detail-drawer" aria-label="Selected Cargo Manifest Detail">
                <div className="drawer-header">
                  <div>
                    <span className="eyebrow">MANIFEST SPECIFICATION</span>
                    <h3>{recordLabel(selectedCargo.tracking_code, selectedCargo.cargo_id)}</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Close detail panel"
                    onClick={() => setSelectedCargoId(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="drawer-body">
                  <div className="drawer-section">
                    <span className="section-label">DESCRIPTION</span>
                    <p className="detail-value-highlight">
                      {redactDatabaseIds(selectedCargo.description ?? 'Description not provided')}
                    </p>
                  </div>

                  <div className="drawer-grid">
                    <div>
                      <span className="section-label">STATUS</span>
                      <StatusPill status={selectedCargo.status} />
                    </div>
                    <div>
                      <span className="section-label">CATEGORY</span>
                      <span className="detail-value">
                        {selectedCargo.category ? formatStatusLabel(selectedCargo.category) : 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="section-label">WEIGHT</span>
                      <span className="metric-num">
                        {selectedCargo.weight != null ? `${selectedCargo.weight} kg` : 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="section-label">VOLUME</span>
                      <span className="metric-num">
                        {selectedCargo.volume != null ? `${selectedCargo.volume} m³` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="section-label">HAZARD CLASS</span>
                      <span className="detail-value">
                        {selectedCargo.hazard_class != null ? `CLASS ${selectedCargo.hazard_class}` : 'Non-hazardous'}
                      </span>
                    </div>
                    <div>
                      <span className="section-label">RETURN CARGO</span>
                      <span className="detail-value">{selectedCargo.is_return_cargo ? 'Yes' : 'No'}</span>
                    </div>
                  </div>

                  {/* Transport Association */}
                  <div className="drawer-section">
                    <span className="section-label">TRANSPORT ASSIGNMENT</span>
                    {selectedLeg ? (
                      <div className="detail-box">
                        <div className="detail-box-row">
                          <span className="box-label">ROUTE:</span>
                          <strong>{locationLabel(selectedLeg.origin)} → {locationLabel(selectedLeg.destination)}</strong>
                        </div>
                        <div className="detail-box-row">
                          <span className="box-label">MODE:</span>
                          <span>{selectedLeg.mode || 'Overland'}</span>
                        </div>
                        <div className="detail-box-row">
                          <span className="box-label">ASSET:</span>
                          <span>{selectedResource ? recordLabel(selectedResource.name, selectedResource.resource_id) : 'Unassigned'}</span>
                        </div>
                        <div className="detail-box-row">
                          <span className="box-label">OPERATION:</span>
                          <span>{selectedExpedition ? recordLabel(selectedExpedition.name || selectedExpedition.code, selectedExpedition.expedition_id) : 'Independent'}</span>
                        </div>
                        {selectedLeg.planned_arrival && (
                          <div className="detail-box-row">
                            <span className="box-label">PLANNED ARRIVAL:</span>
                            <span>{formatDateTime(selectedLeg.planned_arrival)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-secondary">No transport leg assigned to this manifest item.</p>
                    )}
                  </div>

                  {/* Movement History */}
                  <div className="drawer-section">
                    <span className="section-label">AUDITED MOVEMENT LOG</span>
                    {loadingEvents ? (
                      <p className="data-note" role="status">Loading transit events…</p>
                    ) : eventsError ? (
                      <p className="text-muted" role="status">{eventsError}</p>
                    ) : movementEvents.length === 0 ? (
                      <p className="text-muted">No movement events logged for this item.</p>
                    ) : (
                      <ul className="timeline-list">
                        {movementEvents.map((evt) => (
                          <li key={evt.event_id} className="timeline-item">
                            <div className="timeline-marker" />
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <strong>{formatStatusLabel(evt.event_type)}</strong>
                                <span className="timeline-date">{new Date(evt.timestamp_utc).toLocaleDateString()}</span>
                              </div>
                              {evt.reason && <p className="timeline-text">{evt.reason}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

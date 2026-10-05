import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AuditLog, CargoItem, Expedition, Incident, InventoryStock, Personnel, PersonnelAssignment, Recommendation, Station, TransportLeg, TransportResource, WeatherEvent } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { AntarcticMap } from '../components/map/AntarcticMap'
import { apiGet, ApiError } from '../services/api'
import { ErrorBanner } from '../components/common/ErrorBanner'
import { canonicalStationName, formatDateTime, isSupportedIndianStation, recordLabel, safeReference, stationLabelById, stationLabelByReference } from '../utils/display'
import { demoOperationsStore } from '../services/operations-demo'

type Props = {
  stations: Station[]
  stationsError?: string
  weatherError?: string
  personnelError?: string
  assignmentsError?: string
  expeditions: Expedition[]
  transportLegs: TransportLeg[]
  cargoItems: CargoItem[]
  resources?: TransportResource[]
  inventoryStocks: InventoryStock[]
  personnel: Personnel[]
  assignments: PersonnelAssignment[]
  incidents: Incident[]
  recommendations: Recommendation[]
  weatherEvents: WeatherEvent[]
  moduleErrors: Record<string, string>
  onViewImpact: (id: string) => Promise<void>
  onNavigate: (route: string) => void
  impactLoading: boolean
  refreshMarker: string | null
}

export function CommandCenter({
  stations,
  stationsError,
  weatherError: _weatherError,
  personnelError: _personnelError,
  assignmentsError: _assignmentsError,
  expeditions,
  transportLegs,
  cargoItems,
  resources = [],
  inventoryStocks: _inventoryStocks,
  personnel,
  assignments,
  incidents,
  recommendations: _recommendations,
  weatherEvents: _weatherEvents,
  moduleErrors,
  onViewImpact,
  onNavigate,
  impactLoading,
  refreshMarker,
}: Props) {
  const demoState = useSyncExternalStore(demoOperationsStore.subscribe, demoOperationsStore.getState, demoOperationsStore.getState)
  const indianStations = stations.filter(isSupportedIndianStation)
  const unmappedStationCount = stations.filter((station) => !canonicalStationName(station)).length

  const [auditRows, setAuditRows] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')
  const [auditErrorDetails, setAuditErrorDetails] = useState<{ status?: number; endpoint?: string; requestId?: string; body?: string }>()

  const activeExpeditions = expeditions.filter((item) => !['cancelled', 'completed', 'closed'].includes((item.status ?? '').toLowerCase()))
  const openIncidents = incidents.filter((item) => !['resolved', 'closed'].includes((item.status ?? '').toLowerCase()))
  const attentionLegs = transportLegs.filter((leg) => ['delayed', 'cancelled', 'diverted', 'failed', 'disrupted'].includes((leg.status ?? '').toLowerCase()))

  useEffect(() => {
    let mounted = true
    apiGet<AuditLog[]>('/audit-logs')
      .then((rows) => {
        if (!mounted) return
        setAuditRows(Array.isArray(rows) ? rows : [])
        setAuditError('')
      })
      .catch((error) => {
        if (!mounted) return
        setAuditRows([])
        setAuditError(error instanceof Error ? error.message : 'Audit records unavailable.')
        if (error instanceof ApiError) {
          setAuditErrorDetails({
            status: error.status,
            endpoint: error.endpoint,
            requestId: error.requestId,
            body: error.technicalDetails,
          })
        }
      })
      .finally(() => {
        if (mounted) setAuditLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [refreshMarker])

  const demoMoving = demoState.assets.filter((asset) => asset.status === 'IN TRANSIT')
  const totalTrackedAssets = demoState.assets.length + (resources.length || 0)
  const isApiDegraded = !!stationsError || !!moduleErrors.expeditions || !!moduleErrors.transport || !!moduleErrors.incidents

  const activeMission = activeExpeditions[0]
  const missionName = recordLabel(activeMission?.name || activeMission?.code, activeMission?.expedition_id, 'MISSION ARTEMIS · 44TH IAE')
  const missionSeason = activeMission?.season || '2026–27'

  return (
    <div className="page-container command-center" aria-label="Polar Operations Command Center">
      {/* 1. Header: Mission Context + Operational Status */}
      <header className="cc-header">
        <div className="cc-header-context">
          <div className="cc-header-eyebrow">
            <span>POLAR OPERATIONS COMMAND HQ</span>
            <span>·</span>
            <span>SOUTHERN OCEAN SECTOR</span>
          </div>
          <div className="cc-header-title-row">
            <h1>COMMAND CENTER</h1>
            <div className="cc-header-meta">
              <span className="cc-meta-badge">
                MISSION <strong>{missionName}</strong>
              </span>
              <span className="cc-meta-badge">
                SEASON <strong>{missionSeason}</strong>
              </span>
              <span className="cc-meta-badge">
                HQ <strong>NCPOR · GOA</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="cc-header-status">
          <span className="provenance-tag api">API BACKEND</span>
          <div className={`cc-conn-indicator ${isApiDegraded ? 'degraded' : 'connected'}`} role="status">
            <span className={`cc-conn-dot ${isApiDegraded ? '' : 'pulse-live'}`} aria-hidden="true" />
            <span>{isApiDegraded ? 'API DEGRADED' : 'API CONNECTED'}</span>
          </div>
        </div>
      </header>

      {/* Unmapped Station Quality Notification */}
      {unmappedStationCount > 0 && (
        <div className="unavailable-state" role="status">
          Station reference data requires reconciliation for {unmappedStationCount} API record{unmappedStationCount === 1 ? '' : 's'}.
        </div>
      )}

      {/* 2. High-Density Operational KPI Strip */}
      <section className="cc-kpi-strip" aria-label="Operational KPI Strip">
        <button type="button" className="cc-kpi-tile" onClick={() => onNavigate('expeditions')}>
          <div className="cc-kpi-tile-top">
            <span className="cc-kpi-label">Active Expeditions</span>
            <span className="provenance-tag api">API</span>
          </div>
          <div className="cc-kpi-value">{moduleErrors.expeditions ? <span className="cc-kpi-value is-na">NOT AVAILABLE</span> : activeExpeditions.length}</div>
          <div className="cc-kpi-bottom">
            <span>Season {missionSeason}</span>
            <span>→</span>
          </div>
        </button>

        <button type="button" className="cc-kpi-tile" onClick={() => onNavigate('tracking')}>
          <div className="cc-kpi-tile-top">
            <span className="cc-kpi-label">Tracked Assets</span>
            <span className="provenance-tag demo">DEMO + API</span>
          </div>
          <div className="cc-kpi-value">{totalTrackedAssets}</div>
          <div className="cc-kpi-bottom">
            <span>{demoMoving.length} In Transit</span>
            <span>→</span>
          </div>
        </button>

        <button type="button" className="cc-kpi-tile" onClick={() => onNavigate('incidents')}>
          <div className="cc-kpi-tile-top">
            <span className="cc-kpi-label">Open Incidents</span>
            <span className="provenance-tag api">API</span>
          </div>
          <div className={`cc-kpi-value ${openIncidents.length > 0 ? 'is-alert' : ''}`}>
            {moduleErrors.incidents ? <span className="cc-kpi-value is-na">NOT AVAILABLE</span> : openIncidents.length}
          </div>
          <div className="cc-kpi-bottom">
            <span>{openIncidents.filter((i) => (i.severity || '').toLowerCase() === 'critical').length} Critical</span>
            <span>→</span>
          </div>
        </button>

        <button type="button" className="cc-kpi-tile" onClick={() => onNavigate('transport')}>
          <div className="cc-kpi-tile-top">
            <span className="cc-kpi-label">Transport Legs</span>
            <span className="provenance-tag api">API</span>
          </div>
          <div className="cc-kpi-value">{moduleErrors.transport ? <span className="cc-kpi-value is-na">NOT AVAILABLE</span> : transportLegs.length}</div>
          <div className="cc-kpi-bottom">
            <span>{attentionLegs.length ? `${attentionLegs.length} Exceptions` : 'Network Nominal'}</span>
            <span>→</span>
          </div>
        </button>

        <button type="button" className="cc-kpi-tile" onClick={() => onNavigate('cargo')}>
          <div className="cc-kpi-tile-top">
            <span className="cc-kpi-label">Cargo Records</span>
            <span className="provenance-tag api">API</span>
          </div>
          <div className="cc-kpi-value">{moduleErrors.cargo ? <span className="cc-kpi-value is-na">NOT AVAILABLE</span> : cargoItems.length}</div>
          <div className="cc-kpi-bottom">
            <span>{cargoItems.filter((c) => ['in_transit', 'dispatched'].includes((c.status || '').toLowerCase())).length} Moving</span>
            <span>→</span>
          </div>
        </button>

        <button type="button" className="cc-kpi-tile" onClick={() => onNavigate('bases')}>
          <div className="cc-kpi-tile-top">
            <span className="cc-kpi-label">Polar Bases</span>
            <span className="provenance-tag reference">API + REF</span>
          </div>
          <div className="cc-kpi-value">{stationsError ? <span className="cc-kpi-value is-na">NOT AVAILABLE</span> : indianStations.length || stations.length || 3}</div>
          <div className="cc-kpi-bottom">
            <span>Maitri · Bharati · Himadri</span>
            <span>→</span>
          </div>
        </button>
      </section>

      {/* 3. Primary Visual: Polar Operations Map */}
      <section className="cc-map-container" aria-label="Polar Operations Map Anchor">
        <div className="cc-map-header">
          <div>
            <p className="eyebrow">POLAR MARITIME &amp; CONTINENTAL NETWORK</p>
            <h2 style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 800 }}>Polar Operations Map</h2>
          </div>
          <div className="cc-map-actions">
            <span className="provenance-tag api">API OVERLAYS</span>
            <span className="provenance-tag demo">SIMULATED ASSETS</span>
            <button type="button" className="btn-secondary-sm" onClick={() => onNavigate('tracking')}>
              Open Full Map
            </button>
          </div>
        </div>
        <div className="cc-map-body">
          <AntarcticMap
            stations={stations}
            transportLegs={transportLegs}
            incidents={openIncidents}
            expeditions={expeditions}
            cargoItems={cargoItems}
            resources={resources}
            personnel={personnel}
            assignments={assignments}
            onNavigate={onNavigate}
          />
        </div>
      </section>

      {/* 4. 2x2 Operational Status Grid */}
      <div className="cc-grid-2x2">
        {/* Top-Left: Asset / Operational Status Panel */}
        <section className="cc-panel" aria-label="Asset and Operational Status">
          <div className="cc-panel-header">
            <div className="cc-panel-title-area">
              <span className="eyebrow">FLEET &amp; ASSET MONITORING</span>
              <h3>Asset / Operational Status</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="provenance-tag demo">DEMO + API</span>
              <button type="button" className="btn-link" onClick={() => onNavigate('tracking')}>
                Open Fleet
              </button>
            </div>
          </div>
          <div className="cc-panel-body">
            <div className="cc-dense-table-wrapper">
              <table className="cc-dense-table">
                <thead>
                  <tr>
                    <th>Asset ID / Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Mission / Dest</th>
                    <th>Location</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {demoState.assets.slice(0, 6).map((asset) => (
                    <tr key={asset.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('tracking')}>
                      <td>
                        <strong>{asset.id}</strong>
                        <div style={{ fontSize: '9.5px', color: 'var(--polar-muted)' }}>{asset.name}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--polar-muted)' }}>{asset.kind}</span>
                      </td>
                      <td>
                        <StatusPill status={asset.status} />
                      </td>
                      <td>
                        <div style={{ fontSize: '10.5px' }}>{asset.destination}</div>
                        <div style={{ fontSize: '9px', color: 'var(--polar-muted)' }}>{asset.operationId}</div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                          {asset.position.lat.toFixed(2)}°, {asset.position.lon.toFixed(2)}°
                        </span>
                      </td>
                      <td>
                        <span className="provenance-tag demo">SIMULATED</span>
                      </td>
                    </tr>
                  ))}
                  {resources.slice(0, 2).map((res) => (
                    <tr key={res.resource_id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('transport')}>
                      <td>
                        <strong>{res.name || res.registration_code}</strong>
                        <div style={{ fontSize: '9.5px', color: 'var(--polar-muted)' }}>{res.registration_code}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--polar-muted)' }}>{res.type}</span>
                      </td>
                      <td>
                        <StatusPill status={res.status} />
                      </td>
                      <td>
                        <div style={{ fontSize: '10.5px' }}>{res.registration_code || 'Fleet Pool'}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '10px', color: 'var(--polar-muted)' }}>API Record</span>
                      </td>
                      <td>
                        <span className="provenance-tag api">API</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Top-Right: Active Incidents Panel */}
        <section className="cc-panel" aria-label="Active Incidents">
          <div className="cc-panel-header">
            <div className="cc-panel-title-area">
              <span className="eyebrow">SAFETY &amp; ANOMALIES</span>
              <h3>Active Incidents</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="provenance-tag api">API</span>
              <button type="button" className="btn-link" onClick={() => onNavigate('incidents')}>
                Open Incidents
              </button>
            </div>
          </div>
          <div className="cc-panel-body">
            {moduleErrors.incidents ? (
              <p className="data-note">Incident data unavailable from API.</p>
            ) : openIncidents.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {openIncidents.slice(0, 4).map((incident) => (
                  <div key={incident.incident_id} className="cc-incident-card">
                    <div className="cc-incident-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StatusPill status={incident.severity || 'high'} />
                        <strong>{recordLabel(null, incident.incident_id)}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--polar-text)' }}>{incident.type || 'Operational Incident'}</span>
                      </div>
                      <StatusPill status={incident.status} />
                    </div>
                    <div className="cc-incident-meta">
                      <span>Base: {stationLabelById(incident.station_id, stations)}</span>
                      <span>·</span>
                      <span>Declared: {incident.declared_at ? formatDateTime(incident.declared_at, true) : 'Timestamp unavailable'}</span>
                      <span>·</span>
                      <span className="provenance-tag api" style={{ padding: '1px 5px', fontSize: '8.5px' }}>API</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact message="NO OPEN INCIDENTS · ALL POLAR SECTORS REPORT NOMINAL SAFETY" />
            )}
          </div>
        </section>

        {/* Bottom-Left: Expedition Activity Panel */}
        <section className="cc-panel" aria-label="Expedition Activity">
          <div className="cc-panel-header">
            <div className="cc-panel-title-area">
              <span className="eyebrow">OPERATIONAL CAMPAIGNS</span>
              <h3>Expedition Activity</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="provenance-tag api">API</span>
              <button type="button" className="btn-link" onClick={() => onNavigate('demo-operations')}>
                Open Operations
              </button>
            </div>
          </div>
          <div className="cc-panel-body">
            {moduleErrors.expeditions ? (
              <p className="data-note">Expedition data unavailable from API.</p>
            ) : activeExpeditions.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeExpeditions.slice(0, 3).map((item) => (
                  <div key={item.expedition_id} className="cc-dense-row">
                    <div>
                      <strong style={{ fontSize: '12px' }}>{recordLabel(item.name, item.code || item.expedition_id)}</strong>
                      <div style={{ fontSize: '10px', color: 'var(--polar-muted)' }}>
                        Season {item.season || 'Not provided'} · Mission ID: {item.expedition_id}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusPill status={item.status} />
                      <button type="button" className="btn-link" onClick={() => onNavigate('demo-operations')}>
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact message="No active expedition records returned by the API." />
            )}

            {/* Transport Movements Sub-feed */}
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--polar-line)', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="eyebrow">ACTIVE TRANSPORT LEGS</span>
                <button type="button" className="btn-link" style={{ fontSize: '10px' }} onClick={() => onNavigate('transport')}>
                  View All ({transportLegs.length})
                </button>
              </div>
              {transportLegs.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {transportLegs.slice(0, 3).map((leg) => (
                    <div key={leg.leg_id} className="cc-dense-row">
                      <div>
                        <strong style={{ fontSize: '11px' }}>{recordLabel(leg.code, leg.leg_id)}</strong>
                        <div style={{ fontSize: '9.5px', color: 'var(--polar-muted)' }}>
                          {stationLabelByReference(leg.origin, stations, 'origin')} → {stationLabelByReference(leg.destination, stations, 'destination')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusPill status={leg.status} />
                        {attentionLegs.some((l) => l.leg_id === leg.leg_id) && (
                          <button className="btn-link" type="button" disabled={impactLoading} onClick={() => void onViewImpact(leg.leg_id)}>
                            Impact
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState compact message="No transport legs returned by the API." />
              )}
            </div>
          </div>
        </section>

        {/* Bottom-Right: Recent Activity Panel */}
        <section className="cc-panel" aria-label="Recent Activity">
          <div className="cc-panel-header">
            <div className="cc-panel-title-area">
              <span className="eyebrow">AUDIT &amp; OPERATIONS STREAM</span>
              <h3>Recent Activity</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="provenance-tag api">API</span>
              <button type="button" className="btn-link" onClick={() => onNavigate('audit')}>
                Open Audit
              </button>
            </div>
          </div>
          <div className="cc-panel-body">
            {auditError ? (
              <ErrorBanner message={`Audit records unavailable: ${auditError}`} details={auditErrorDetails} />
            ) : auditLoading ? (
              <p role="status" className="data-note">Loading canonical audit records...</p>
            ) : auditRows.length ? (
              <div className="cc-dense-table-wrapper">
                <table className="cc-dense-table">
                  <thead>
                    <tr>
                      <th>Time (UTC)</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.slice(0, 6).map((row) => (
                      <tr key={row.log_id}>
                        <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                          {Number.isNaN(Date.parse(row.timestamp_utc)) ? 'Invalid timestamp' : formatDateTime(row.timestamp_utc)}
                        </td>
                        <td>{safeReference(row.actor_user?.full_name || row.actor_user?.employee_code || row.actor, 'System Actor')}</td>
                        <td>
                          <span style={{ fontWeight: 650, color: 'var(--polar-cyan)' }}>{row.action}</span>
                        </td>
                        <td>
                          {row.entity_type} {row.entity_id ? `· ${safeReference(row.entity_id)}` : ''}
                        </td>
                        <td>
                          <span style={{ fontSize: '9.5px', color: 'var(--polar-muted)' }}>{safeReference(row.sync_origin || row.device_id, 'HQ-Server')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState compact message="No canonical audit records returned by the API." />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

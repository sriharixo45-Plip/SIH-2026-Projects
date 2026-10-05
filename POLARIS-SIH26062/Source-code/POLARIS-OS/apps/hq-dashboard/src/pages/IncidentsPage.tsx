import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Incident, Personnel, Station, TransportLeg } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiPost, ApiError } from '../services/api'
import { isSupportedIndianStation, recordLabel, stationLabelByReference, transportLabelById } from '../utils/display'
import { Timestamp } from '../components/common/Timestamp'
import { TechnicalDetails } from '../components/common/TechnicalDetails'

type IncidentsPageProps = {
  incidents: Incident[]
  dataError?: string
  stations: Station[]
  transportLegs: TransportLeg[]
  personnel: Personnel[]
  onRefresh: () => void
  currentUserId?: string
}

function getSeverityClass(severity?: string | null): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'is-critical'
  if (['high', 'severe'].includes(s)) return 'is-warning'
  return ''
}

function getSeverityMark(severity?: string | null): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'critical'
  if (['high', 'severe'].includes(s)) return 'high'
  if (['moderate', 'medium'].includes(s)) return 'moderate'
  if (s === 'low') return 'low'
  return 'unknown'
}

export function IncidentsPage({ incidents, dataError, stations, transportLegs, personnel, onRefresh, currentUserId }: IncidentsPageProps) {
  useEffect(() => {
    const id = sessionStorage.getItem('polaris_api_incident_focus')
    if (id) {
      document.getElementById(`api-incident-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      sessionStorage.removeItem('polaris_api_incident_focus')
    }
  }, [])

  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [type, setType] = useState('transport_disruption')
  const [severity, setSeverity] = useState<'low' | 'moderate' | 'high' | 'critical'>('high')
  const [stationId, setStationId] = useState('')
  const [legId, setLegId] = useState('')
  const [description, setDescription] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')

  const handleCreateIncident = async (e: FormEvent) => {
    e.preventDefault()
    if (!description.trim()) { setFormError('Description is required.'); return }
    if (!currentUserId) { setFormError('User authentication context missing.'); return }
    setIsSubmitting(true); setFormError(null); setFormSuccess(null)
    try {
      await apiPost('/incidents', { type, severity, station_id: stationId || undefined, leg_id: legId || undefined, description: description.trim(), declared_by: currentUserId, status: 'declared' })
      setFormSuccess('Incident logged and declared successfully.')
      setDescription(''); setShowForm(false); onRefresh()
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 403 ? 'The server rejected this incident declaration as unauthorized.' : err instanceof Error ? err.message : 'Unable to log incident'
      setFormError(msg)
    } finally { setIsSubmitting(false) }
  }

  const filtered = useMemo(() => incidents.filter(inc => {
    const matchSev = severityFilter === 'all' || (inc.severity ?? '').toLowerCase() === severityFilter
    const matchStat = statusFilter === 'all' || (inc.status ?? '').toLowerCase() === statusFilter
    const matchQuery = !query || (inc.description ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (inc.type ?? '').toLowerCase().includes(query.toLowerCase())
    return matchSev && matchStat && matchQuery
  }), [incidents, severityFilter, statusFilter, query])

  const kpi = useMemo(() => {
    const open = incidents.filter(i => !['resolved', 'closed'].includes((i.status ?? '').toLowerCase())).length
    const critical = incidents.filter(i => (i.severity ?? '').toLowerCase() === 'critical').length
    const investigating = incidents.filter(i => (i.status ?? '').toLowerCase() === 'investigating').length
    const resolved = incidents.filter(i => ['resolved', 'closed'].includes((i.status ?? '').toLowerCase())).length
    return { total: incidents.length, open, critical, investigating, resolved }
  }, [incidents])

  const hasCritical = kpi.critical > 0

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="op-page-header">
        <div className="op-page-header-left">
          <p className="op-page-eyebrow">
            RESPONSE & CRISIS MANAGEMENT
            <span className="prov-chip api">API</span>
          </p>
          <h1 className="op-page-title">Incidents</h1>
          <p className="op-page-desc">Operational incidents declared by field operators and HQ personnel requiring attention and response.</p>
        </div>
        <div className="op-page-header-right">
          <button
            type="button"
            className="btn-primary"
            onClick={() => { setShowForm(!showForm); setFormError(null); setFormSuccess(null) }}
          >
            {showForm ? 'Cancel' : '+ Report Incident'}
          </button>
        </div>
      </div>

      {/* CRITICAL ALERT BANNER */}
      {hasCritical && !dataError && (
        <div className="incident-critical-banner" role="alert">
          <div className="severity-mark critical" />
          <strong>{kpi.critical} CRITICAL INCIDENT{kpi.critical !== 1 ? 'S' : ''}</strong>
          <span>requiring immediate attention</span>
        </div>
      )}

      {/* KPI STRIP */}
      {!dataError && (
        <div className="op-kpi-strip">
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Total</span>
            <span className="op-kpi-value">{kpi.total}</span>
            <span className="op-kpi-sub">incident records</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Open</span>
            <span className={`op-kpi-value${kpi.open > 0 ? ' kpi-warning' : ' kpi-muted'}`}>{kpi.open}</span>
            <span className="op-kpi-sub">not yet resolved</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Critical</span>
            <span className={`op-kpi-value${kpi.critical > 0 ? ' kpi-danger' : ' kpi-muted'}`}>{kpi.critical}</span>
            <span className="op-kpi-sub">highest severity</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Investigating</span>
            <span className="op-kpi-value">{kpi.investigating}</span>
            <span className="op-kpi-sub">under review</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Resolved</span>
            <span className="op-kpi-value kpi-success">{kpi.resolved}</span>
            <span className="op-kpi-sub">closed out</span>
          </div>
        </div>
      )}

      {/* INCIDENT DECLARATION FORM */}
      {showForm && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">DECLARE NEW OPERATIONAL INCIDENT</p>
              <h2>Incident declaration</h2>
            </div>
          </div>
          {formSuccess && <div className="notice-banner">{formSuccess}</div>}
          {formError && <div className="error-banner">{formError}</div>}
          {stations.some(s => !isSupportedIndianStation(s)) && (
            <details className="station-reconciliation-notice">
              <summary>Station reference requires reconciliation</summary>
              <p>Some API station records do not map to the canonical incident station list. Existing records are preserved; new incidents can reference Maitri or Bharati.</p>
              <span>Source: API · Canonical match: unavailable</span>
            </details>
          )}
          <div className="panel-body form-section">
            <form onSubmit={handleCreateIncident} className="grid-form">
              <div className="form-group">
                <label htmlFor="incident-type">Incident type</label>
                <select id="incident-type" className="select-input" value={type} onChange={e => setType(e.target.value)}>
                  <option value="transport_disruption">TRANSPORT DISRUPTION</option>
                  <option value="cargo_issue">CARGO ISSUE</option>
                  <option value="weather_delay">WEATHER DELAY</option>
                  <option value="personnel_issue">PERSONNEL ISSUE</option>
                  <option value="equipment_failure">EQUIPMENT FAILURE</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="incident-severity">Severity</label>
                <select id="incident-severity" className="select-input" value={severity} onChange={e => setSeverity(e.target.value as typeof severity)}>
                  <option value="low">LOW</option>
                  <option value="moderate">MODERATE</option>
                  <option value="high">HIGH</option>
                  <option value="critical">CRITICAL</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="incident-station">Station (optional)</label>
                <select id="incident-station" className="select-input" value={stationId} onChange={e => setStationId(e.target.value)}>
                  <option value="">NONE / REGIONAL</option>
                  {stations.filter(isSupportedIndianStation).map(s => (
                    <option key={s.station_id} value={s.station_id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="incident-leg">Transport leg (optional)</label>
                <select id="incident-leg" className="select-input" value={legId} onChange={e => setLegId(e.target.value)}>
                  <option value="">NONE</option>
                  {transportLegs.map(l => (
                    <option key={l.leg_id} value={l.leg_id}>
                      {recordLabel(l.code, l.leg_id)} ({stationLabelByReference(l.origin, stations, 'origin')} → {stationLabelByReference(l.destination, stations, 'destination')})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group full-width">
                <label htmlFor="incident-description">Description and impact details</label>
                <textarea id="incident-description" className="textarea-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the operational disruption, affected assets, or required response…" required />
              </div>
              <div className="form-actions full-width">
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : 'Submit Incident Declaration'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* FILTER BAR */}
      {!dataError && !showForm && (
        <div className="op-filter-bar">
          <span className="op-filter-label">Severity</span>
          <select className="select-input" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </select>
          <div className="op-filter-sep" />
          <span className="op-filter-label">Status</span>
          <select className="select-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="declared">Declared</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
          </select>
          <div className="op-filter-sep" />
          <input className="text-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Description, type…" aria-label="Search incidents" />
        </div>
      )}

      {/* INCIDENT TABLE */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">OPERATIONAL INCIDENT LOG</p>
            <h2>{dataError ? 'Incident data unavailable' : `Incidents (${filtered.length})`}</h2>
          </div>
        </div>

        {dataError ? (
          <div className="panel-body">
            <div className="op-empty-state">
              <div className="op-empty-icon">⚠</div>
              <p className="op-empty-title">INCIDENT DATA UNAVAILABLE</p>
              <p className="op-empty-desc">{dataError}</p>
              <span className="op-empty-source">SOURCE: API · REQUEST FAILED</span>
            </div>
          </div>
        ) : incidents.length === 0 ? (
          <div className="panel-body">
            <div className="op-empty-state">
              <div className="op-empty-icon">✓</div>
              <p className="op-empty-title">NO INCIDENTS DECLARED</p>
              <p className="op-empty-desc">No incidents have been declared in the current operational period.</p>
              <span className="op-empty-source">SOURCE: API</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel-body">
            <EmptyState message="No incidents match the current filters." />
          </div>
        ) : (
          <div className="op-table-wrap">
            <table className="op-table">
              <thead>
                <tr>
                  <th>Incident reference</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Station</th>
                  <th>Transport</th>
                  <th>Status</th>
                  <th>Declared by</th>
                  <th>Declared</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inc => {
                  const declarer = personnel.find(p => p.user_id === inc.declared_by || p.person_id === inc.declared_by)
                  const declaredBy = recordLabel(declarer?.name || [declarer?.first_name, declarer?.last_name].filter(Boolean).join(' '), declarer?.employee_code || inc.declared_by, 'Not provided')
                  const station = stations.find(s => s.station_id === inc.station_id)
                  const stationMapped = station ? isSupportedIndianStation(station) : true
                  const stationDisplay = station ? (stationMapped ? station.name : 'Station mapping unavailable') : inc.station_id ? 'Station mapping unavailable' : 'Not provided'
                  return (
                    <tr
                      id={`api-incident-${inc.incident_id}`}
                      key={inc.incident_id}
                      className={getSeverityClass(inc.severity)}
                    >
                      <td>
                        <span className="op-cell-mono">{recordLabel(null, inc.incident_id)}</span>
                        <TechnicalDetails fields={[
                          { label: 'Incident ID', value: inc.incident_id },
                          { label: 'Declared by ID', value: inc.declared_by },
                          { label: 'Station mapping', value: station ? stationMapped ? undefined : 'Station mapping unavailable' : inc.station_id ? 'Station mapping unavailable' : undefined },
                          { label: 'Station ID', value: inc.station_id },
                          { label: 'Transport reference', value: inc.leg_id }
                        ]} />
                      </td>
                      <td><span className="op-cell-secondary">{formatStatusLabel(inc.type)}</span></td>
                      <td>
                        <div className="severity-bar">
                          <span className={`severity-mark ${getSeverityMark(inc.severity)}`} />
                          <StatusPill status={inc.severity} />
                        </div>
                      </td>
                      <td><span className="op-cell-secondary" style={{ maxWidth: '240px', display: 'block' }}>{inc.description || 'Not provided'}</span></td>
                      <td><span className="op-cell-secondary">{stationDisplay}</span></td>
                      <td><span className="op-cell-secondary">{transportLabelById(inc.leg_id, transportLegs)}</span></td>
                      <td><StatusPill status={inc.status} /></td>
                      <td><span className="op-cell-secondary">{declaredBy}</span></td>
                      <td><Timestamp value={inc.declared_at} compact /></td>
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

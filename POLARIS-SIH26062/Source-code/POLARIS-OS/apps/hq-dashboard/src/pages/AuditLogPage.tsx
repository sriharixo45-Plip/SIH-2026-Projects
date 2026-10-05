import { useEffect, useMemo, useState } from 'react'
import type { AuditLog } from '../types'
import { apiGet, ApiError } from '../services/api'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorBanner } from '../components/common/ErrorBanner'
import { Timestamp } from '../components/common/Timestamp'
import { formatStatusLabel } from '../components/common/StatusPill'
import { recordLabel, safeReference } from '../utils/display'

function actionLabel(action: string, entityType: string) {
  const normalized = (action || '').toLowerCase().replace(/[._-]+/g, ' ').trim()
  const entity = entityType.toLowerCase().replace(/[._-]+/g, ' ').trim()
  if (/sync.*accept/.test(normalized)) return 'Sync accepted'
  if (/conflict.*resolv/.test(normalized)) return 'Conflict resolved'
  if (/assign/.test(normalized)) return 'Assignment changed'
  if (/status|transition/.test(normalized)) return 'Status changed'
  if (['create', 'created'].includes(normalized) || normalized.endsWith(' create'))
    return `${entity ? formatStatusLabel(entity) : 'Record'} created`
  if (['update', 'updated'].includes(normalized) || normalized.endsWith(' update'))
    return `${entity ? formatStatusLabel(entity) : 'Record'} updated`
  if (['delete', 'deleted'].includes(normalized)) return `${entity ? formatStatusLabel(entity) : 'Record'} deleted`
  return normalized ? formatStatusLabel(normalized) : 'Action recorded'
}

const knownLabels: Record<string, string> = {
  cargoid: 'Cargo ID',
  trackingcode: 'Tracking code',
  returncargo: 'Return cargo',
  weightkg: 'Weight (kg)',
  volumem3: 'Volume (m³)',
  incidentid: 'Incident ID',
  employeeid: 'Employee ID',
  employeecode: 'Employee ID',
  roleid: 'Role ID',
  stationid: 'Station ID',
  operationid: 'Operation ID',
  expeditionid: 'Expedition ID',
  syncstatus: 'Sync status',
  deviceid: 'Device ID',
  baseversion: 'Base version',
}

function labelFor(key: string) {
  const compact = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return knownLabels[compact] || formatStatusLabel(key.replace(/_/g, ' '))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function readable(value: unknown): string {
  if (value == null || value === '') return 'Not available'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorDetails, setErrorDetails] = useState<{
    status?: number
    endpoint?: string
    requestId?: string
    body?: string
  }>()

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'operational' | 'auth' | 'admin'>('ALL')
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    setErrorDetails(undefined)
    try {
      const data = await apiGet<AuditLog[]>('/audit-logs')
      if (!Array.isArray(data)) throw new Error('The API returned an unexpected audit data format.')
      setLogs(data)
    } catch (cause) {
      setLogs([])
      setError(cause instanceof Error ? cause.message : 'Canonical audit records unavailable.')
      if (cause instanceof ApiError) {
        setErrorDetails({
          status: cause.status,
          endpoint: cause.endpoint,
          requestId: cause.requestId,
          body: cause.technicalDetails,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Filtered
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return logs.filter((row) => {
      const action = (row.action || '').toLowerCase()
      if (categoryFilter === 'auth' && !/auth|login|token|session/i.test(action)) return false
      if (categoryFilter === 'admin' && !/user|role|permission|admin/i.test(action)) return false
      if (
        categoryFilter === 'operational' &&
        (/auth|login|token|session/i.test(action) || /user|role|permission|admin/i.test(action))
      )
        return false

      if (!q) return true
      return [
        row.actor,
        row.actor_user?.full_name,
        row.action,
        row.entity_type,
        row.entity_id,
        row.device_id,
        row.sync_origin,
        row.reason,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    })
  }, [logs, query, categoryFilter])

  const selectedLog = useMemo(() => {
    if (!selectedLogId) return null
    return logs.find((l) => l.log_id === selectedLogId) || null
  }, [logs, selectedLogId])

  // KPIs
  const kpis = useMemo(() => {
    const total = logs.length
    const authEvents = logs.filter((l) => /auth|login|token|session/i.test(l.action || '')).length
    const adminEvents = logs.filter((l) => /user|role|permission|admin/i.test(l.action || '')).length
    const operationalEvents = total - authEvents - adminEvents
    return { total, authEvents, adminEvents, operationalEvents }
  }, [logs])

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">SYSTEM LEDGER & AUDIT TRAIL</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>Canonical Audit Log</h2>
          <p className="page-subtitle">
            Immutable chronicle of operator decisions, field device synchronizations, authentication sessions, and record mutations.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
            Refresh Ledger
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Audit KPIs">
        <div className="kpi-card">
          <span className="kpi-label">TOTAL LOGGED EVENTS</span>
          <span className="kpi-value">{kpis.total}</span>
          <span className="kpi-hint">Recorded audit entries</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">OPERATIONAL EVENTS</span>
          <span className="kpi-value info">{kpis.operationalEvents}</span>
          <span className="kpi-hint">Missions, legs, cargo, sync</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">AUTH & SESSIONS</span>
          <span className="kpi-value success">{kpis.authEvents}</span>
          <span className="kpi-hint">Sign-in & token events</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">ADMINISTRATIVE</span>
          <span className="kpi-value warning">{kpis.adminEvents}</span>
          <span className="kpi-hint">User & role management</span>
        </div>
      </section>

      {error && <ErrorBanner message="Audit activity could not be loaded." details={errorDetails} onRetry={() => void load()} />}

      {/* Main Panel */}
      <section className="panel">
        <div className="operational-toolbar">
          <div className="filter-group">
            <label htmlFor="audit-search" className="sr-only">
              Search audit records
            </label>
            <input
              id="audit-search"
              type="search"
              className="text-input filter-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actor, action, entity, device, or reason…"
            />
          </div>
          <div className="filter-group">
            <span className="filter-label">Category:</span>
            <div className="btn-group">
              {(['ALL', 'operational', 'auth', 'admin'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`btn-filter ${categoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="data-note" role="status">
            Loading immutable audit records…
          </p>
        ) : filtered.length === 0 ? (
          <EmptyState
            message={
              logs.length
                ? 'No audit records match the search filter.'
                : 'The canonical audit endpoint returned no records.'
            }
          />
        ) : (
          <div className={`table-drawer-layout ${selectedLog ? 'with-drawer' : ''}`}>
            <div className="table-scroll">
              <table className="dense-table" aria-label="Audit Activity Records">
                <thead>
                  <tr>
                    <th>Timestamp (UTC / IST)</th>
                    <th>Activity / Action</th>
                    <th>Target Record</th>
                    <th>Actor / Source</th>
                    <th>Reason / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const isSelected = selectedLogId === row.log_id
                    return (
                      <tr
                        key={row.log_id}
                        className={`table-row-selectable ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedLogId(row.log_id)}
                      >
                        <td>
                          <Timestamp value={row.timestamp_utc} compact />
                        </td>
                        <td>
                          <div className="cell-primary">
                            <span className="badge-tag">{actionLabel(row.action || '', row.entity_type)}</span>
                            <span className="table-subtext">{row.action}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-primary">
                            <strong>{formatStatusLabel(row.entity_type)}</strong>
                            <code className="record-code">{recordLabel(null, row.entity_id)}</code>
                          </div>
                        </td>
                        <td>
                          <div className="cell-primary">
                            <strong>{safeReference(row.actor_user?.full_name || row.actor, 'System')}</strong>
                            <span className="table-subtext">
                              Origin: {formatStatusLabel(row.sync_origin || (row.device_id ? 'Field device' : 'HQ Console'))}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-primary">
                            <span className="text-secondary">{row.reason || 'Standard system action'}</span>
                            {row.device_id && <span className="table-subtext">Device: {row.device_id}</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Detail Drawer */}
            {selectedLog && (
              <aside className="detail-drawer" aria-label="Audit Event Details">
                <div className="drawer-header">
                  <div>
                    <span className="eyebrow">AUDIT RECORD INSPECTOR</span>
                    <h3>{actionLabel(selectedLog.action || '', selectedLog.entity_type)}</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Close detail drawer"
                    onClick={() => setSelectedLogId(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="drawer-body">
                  <div className="drawer-grid">
                    <div>
                      <span className="section-label">LOG UUID</span>
                      <code className="code-badge">{selectedLog.log_id}</code>
                    </div>
                    <div>
                      <span className="section-label">EXACT TIMESTAMP</span>
                      <Timestamp value={selectedLog.timestamp_utc} />
                    </div>
                    <div>
                      <span className="section-label">TARGET ENTITY</span>
                      <span className="detail-value">
                        {formatStatusLabel(selectedLog.entity_type)} · {recordLabel(null, selectedLog.entity_id)}
                      </span>
                    </div>
                    <div>
                      <span className="section-label">ACTION ID</span>
                      <span className="detail-value">{selectedLog.action}</span>
                    </div>
                    <div>
                      <span className="section-label">OPERATOR / ACTOR</span>
                      <span className="detail-value">
                        {safeReference(selectedLog.actor_user?.full_name || selectedLog.actor)}
                      </span>
                    </div>
                    <div>
                      <span className="section-label">SYNC ORIGIN</span>
                      <span className="detail-value">
                        {formatStatusLabel(selectedLog.sync_origin || (selectedLog.device_id ? 'Offline device' : 'HQ Console'))}
                      </span>
                    </div>
                  </div>

                  {selectedLog.reason && (
                    <div className="drawer-section">
                      <span className="section-label">RECORDED REASON</span>
                      <p className="detail-value-highlight">{selectedLog.reason}</p>
                    </div>
                  )}

                  {/* Field diffs if old/new exist */}
                  {(() => {
                    const before = asRecord(selectedLog.old_value)
                    const after = asRecord(selectedLog.new_value)
                    const combined = { ...(before || {}), ...(after || {}) }
                    const recordFields = Object.entries(combined).map(([k, v]) => ({
                      label: labelFor(k),
                      value: readable(v),
                    }))

                    if (recordFields.length === 0) return null

                    return (
                      <div className="drawer-section">
                        <span className="section-label">AFFECTED RECORD FIELDS</span>
                        <dl className="property-list">
                          {recordFields.map((field) => (
                            <div key={field.label} className="property-row">
                              <dt>{field.label}</dt>
                              <dd>{field.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )
                  })()}

                  <details className="technical-details-raw">
                    <summary>View raw JSON payload</summary>
                    <pre className="payload-preview">
                      {JSON.stringify(
                        {
                          old_value: selectedLog.old_value ?? null,
                          new_value: selectedLog.new_value ?? null,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              </aside>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

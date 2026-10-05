import { useEffect, useMemo, useState } from 'react'
import type { SyncOperation } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { Timestamp } from '../components/common/Timestamp'
import { apiGet, apiPatch, ApiError } from '../services/api'
import { safeReference } from '../utils/display'
import { ErrorBanner } from '../components/common/ErrorBanner'

const operationLabel = (value?: string | null) => {
  const label = formatStatusLabel(value)
  return label === 'Unknown' ? 'Operation' : label
}

const fieldLabel = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const payloadRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

const displayValue = (value: unknown) =>
  value == null || value === ''
    ? 'Not provided'
    : typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)

const syncAction = (operation: SyncOperation) => {
  const status = (operation.status || '').toLowerCase()
  if (status === 'synced') return 'Applied to server'
  if (status === 'conflicted') return 'Review conflict'
  if (status === 'rejected') return 'Rejected'
  if (status === 'pending') return 'Awaiting reconciliation'
  return 'No action required'
}

const recordName = (payload: unknown, entityType?: string | null) => {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const code = data.code || data.expedition_code || data.leg_code || data.tracking_code
  const name = data.name || data.expedition_name || data.description || data.item_name
  if (code && name) return `${String(code)} — ${String(name)}`
  if (code || name) return String(code || name)
  return `${formatStatusLabel(entityType)} record`
}

export function SyncOperationsPage() {
  const [syncOps, setSyncOps] = useState<SyncOperation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorDetails, setErrorDetails] = useState<{
    status?: number
    endpoint?: string
    requestId?: string
    body?: string
  }>()
  const [processingId, setProcessingId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null)

  const fetchSyncOps = async () => {
    setLoading(true)
    setError('')
    setErrorDetails(undefined)
    try {
      const data = await apiGet<SyncOperation[]>('/sync-operations')
      if (!Array.isArray(data)) throw new Error('The API returned an unexpected sync data format.')
      setSyncOps(data)
    } catch (e) {
      setSyncOps([])
      setError(e instanceof Error ? e.message : 'Sync operation records unavailable.')
      if (e instanceof ApiError) {
        setErrorDetails({
          status: e.status,
          endpoint: e.endpoint,
          requestId: e.requestId,
          body: e.technicalDetails,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSyncOps()
  }, [])

  const act = async (id: string, action: 'reject') => {
    setProcessingId(id)
    setError('')
    setErrorDetails(undefined)
    try {
      await apiPatch(`/sync-operations/${id}/${action}`, {})
      await fetchSyncOps()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to ${action} operation.`)
      if (e instanceof ApiError) {
        setErrorDetails({
          status: e.status,
          endpoint: e.endpoint,
          requestId: e.requestId,
          body: e.technicalDetails,
        })
      }
    } finally {
      setProcessingId(null)
    }
  }

  const filteredOps = useMemo(() => {
    return syncOps.filter((op) => {
      const status = (op.status || 'unknown').toLowerCase()
      if (statusFilter !== 'ALL' && status !== statusFilter.toLowerCase()) return false
      if (!searchTerm) return true
      const s = searchTerm.toLowerCase()
      const opType = (op.operation_type || '').toLowerCase()
      const entityType = (op.target_entity_type || '').toLowerCase()
      const opId = (op.op_id || '').toLowerCase()
      const targetId = (op.target_entity_id || '').toLowerCase()
      const device = (op.device_id || '').toLowerCase()
      const actor = (op.performed_by || '').toLowerCase()
      return (
        opType.includes(s) ||
        entityType.includes(s) ||
        opId.includes(s) ||
        targetId.includes(s) ||
        device.includes(s) ||
        actor.includes(s)
      )
    })
  }, [syncOps, statusFilter, searchTerm])

  const selectedOp = useMemo(() => {
    if (!selectedOpId) return null
    return syncOps.find((o) => o.op_id === selectedOpId) || null
  }, [syncOps, selectedOpId])

  // KPIs
  const kpis = useMemo(() => {
    const total = syncOps.length
    const synced = syncOps.filter((o) => (o.status || '').toLowerCase() === 'synced').length
    const pending = syncOps.filter((o) => (o.status || '').toLowerCase() === 'pending').length
    const conflicted = syncOps.filter((o) => (o.status || '').toLowerCase() === 'conflicted').length
    const rejected = syncOps.filter((o) => ['rejected', 'failed'].includes((o.status || '').toLowerCase())).length
    return { total, synced, pending, conflicted, rejected }
  }, [syncOps])

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">FIELD TELEMETRY & RECONCILIATION</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>Field Synchronization</h2>
          <p className="page-subtitle">
            Asynchronous field device operations queue, deterministic sequence numbering, and server-side state reconciliation.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => void fetchSyncOps()} disabled={loading}>
            Refresh Queue
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Sync Metrics">
        <div className="kpi-card">
          <span className="kpi-label">TOTAL OPERATIONS</span>
          <span className="kpi-value">{kpis.total}</span>
          <span className="kpi-hint">Processed or queued</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">SYNCED (APPLIED)</span>
          <span className="kpi-value success">{kpis.synced}</span>
          <span className="kpi-hint">Reconciled to server</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">PENDING QUEUE</span>
          <span className="kpi-value warning">{kpis.pending}</span>
          <span className="kpi-hint">Awaiting processing</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">CONFLICTS</span>
          <span className="kpi-value alert">{kpis.conflicted}</span>
          <span className="kpi-hint">Competing mutations</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">REJECTED / FAILED</span>
          <span className="kpi-value">{kpis.rejected}</span>
          <span className="kpi-hint">Rejected or invalidated</span>
        </div>
      </section>

      {error && <ErrorBanner message={error} details={errorDetails} onRetry={() => void fetchSyncOps()} />}

      {/* Main Panel */}
      <section className="panel">
        <div className="operational-toolbar">
          <div className="filter-group">
            <label htmlFor="sync-search" className="sr-only">
              Search sync operations
            </label>
            <input
              id="sync-search"
              type="search"
              className="text-input filter-search"
              placeholder="Filter by op ID, entity, device, actor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <div className="btn-group">
              {['ALL', 'synced', 'pending', 'conflicted', 'rejected'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn-filter ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="data-note" role="status">
            Loading field sync operation records…
          </p>
        ) : error ? (
          <div className="unavailable-state" role="status">
            Sync records could not be loaded.
          </div>
        ) : filteredOps.length === 0 ? (
          <EmptyState
            message={
              syncOps.length === 0
                ? 'No sync operation records returned by the API.'
                : 'No sync operations match the active filter criteria.'
            }
          />
        ) : (
          <div className={`table-drawer-layout ${selectedOp ? 'with-drawer' : ''}`}>
            <div className="table-scroll">
              <table className="dense-table" aria-label="Field Sync Operations">
                <thead>
                  <tr>
                    <th>Operation / Seq</th>
                    <th>Target Record</th>
                    <th>Source Device / Performer</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOps.map((op) => {
                    const status = (op.status || 'unknown').toLowerCase()
                    const isPending = status === 'pending'
                    const isSelected = selectedOpId === op.op_id
                    const target = safeReference(op.target_entity_id, '')

                    return (
                      <tr
                        key={op.op_id}
                        className={`table-row-selectable ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedOpId(op.op_id)}
                      >
                        <td>
                          <div className="cell-primary">
                            <span className="badge-tag">{operationLabel(op.operation_type)}</span>
                            <span className="seq-badge">#{op.local_sequence_number ?? '—'}</span>
                          </div>
                          <span className="table-subtext">Op: {op.op_id}</span>
                        </td>
                        <td>
                          <div className="cell-primary">
                            <strong>{recordName(op.payload, op.target_entity_type)}</strong>
                            <span className="table-subtext">
                              {formatStatusLabel(op.target_entity_type)} · {target || 'ID N/A'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-primary">
                            <span>{op.device_id ? `Device ${op.device_id}` : 'Direct API'}</span>
                            <span className="table-subtext">{safeReference(op.performed_by, 'Unknown actor')}</span>
                          </div>
                        </td>
                        <td>
                          <StatusPill status={status} />
                        </td>
                        <td>
                          <Timestamp value={op.applied_at || op.local_timestamp} compact />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {isPending ? (
                            <button
                              type="button"
                              className="btn-danger-sm"
                              disabled={processingId === op.op_id}
                              onClick={() => void act(op.op_id, 'reject')}
                            >
                              {processingId === op.op_id ? 'Rejecting…' : 'Reject'}
                            </button>
                          ) : (
                            <span className="data-note">{syncAction(op)}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Detail Drawer */}
            {selectedOp && (
              <aside className="detail-drawer" aria-label="Sync Operation Details">
                <div className="drawer-header">
                  <div>
                    <span className="eyebrow">SYNC OPERATION DETAIL</span>
                    <h3>{operationLabel(selectedOp.operation_type)}</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Close detail drawer"
                    onClick={() => setSelectedOpId(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="drawer-body">
                  <div className="drawer-section">
                    <span className="section-label">STATUS</span>
                    <StatusPill status={selectedOp.status || 'unknown'} />
                  </div>

                  <div className="drawer-grid">
                    <div>
                      <span className="section-label">OP ID</span>
                      <code className="code-badge">{selectedOp.op_id}</code>
                    </div>
                    <div>
                      <span className="section-label">SEQUENCE #</span>
                      <span className="detail-value">{selectedOp.local_sequence_number ?? 'N/A'}</span>
                    </div>
                    <div>
                      <span className="section-label">BASE VERSION</span>
                      <span className="detail-value">{selectedOp.base_version ?? 'Initial'}</span>
                    </div>
                    <div>
                      <span className="section-label">SOURCE DEVICE</span>
                      <span className="detail-value">{selectedOp.device_id || 'Direct field client'}</span>
                    </div>
                    <div>
                      <span className="section-label">PERFORMED BY</span>
                      <span className="detail-value">{safeReference(selectedOp.performed_by)}</span>
                    </div>
                    <div>
                      <span className="section-label">TIMESTAMP</span>
                      <Timestamp value={selectedOp.applied_at || selectedOp.local_timestamp} />
                    </div>
                  </div>

                  {/* Payload values */}
                  <div className="drawer-section">
                    <span className="section-label">RECORD PAYLOAD ATTRIBUTES</span>
                    {(() => {
                      const payload = payloadRecord(selectedOp.payload)
                      const entries = Object.entries(payload)
                      if (entries.length === 0) {
                        return <p className="text-secondary">No payload attributes provided.</p>
                      }
                      return (
                        <dl className="property-list">
                          {entries.map(([k, v]) => (
                            <div key={k} className="property-row">
                              <dt>{fieldLabel(k)}</dt>
                              <dd>{displayValue(v)}</dd>
                            </div>
                          ))}
                        </dl>
                      )
                    })()}
                  </div>

                  {/* Raw JSON */}
                  <details className="technical-details-raw">
                    <summary>View raw sync JSON</summary>
                    <pre className="payload-preview">{JSON.stringify(selectedOp, null, 2)}</pre>
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch } from '../services/api'
import { EmptyState } from '../components/common/EmptyState'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { Timestamp } from '../components/common/Timestamp'
import { RecordReference } from '../components/common/RecordReference'
import { recordLabel } from '../utils/display'

type OperationDetail = {
  op_id: string
  device_id?: string | null
  performed_by?: string | null
  local_sequence_number?: number | null
  operation_type?: string | null
  payload?: unknown
  base_version?: number | null
  local_timestamp?: string | null
  status?: string | null
}

type SyncConflict = {
  conflict_id: string
  entity_type: string
  entity_id: string
  competing_operations: string[] | string
  operation_details?: OperationDetail[] | null
  server_value?: unknown
  server_version?: number | null
  resolution?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
}

function objectValue(value: unknown): Record<string, unknown> {
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

function valueLabel(value: unknown, exists: boolean): string {
  if (!exists) return 'Not present in record'
  if (value == null || value === '') return 'Not recorded'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function fieldLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function recordName(value: unknown, entityType: string, id: string) {
  const data = objectValue(value)
  const code = data.code || data.expedition_code || data.leg_code || data.tracking_code
  const name = data.name || data.expedition_name || data.description || data.item_name
  if (code && name) return `${String(code)} - ${String(name)}`
  if (code || name) return String(code || name)
  return `${formatStatusLabel(entityType)} · ${recordLabel(null, id)}`
}

function differences(serverValue: unknown, incomingValue: unknown) {
  const server = objectValue(serverValue)
  const incoming = objectValue(incomingValue)
  return [...new Set([...Object.keys(server), ...Object.keys(incoming)])]
    .filter((key) => JSON.stringify(server[key]) !== JSON.stringify(incoming[key]))
    .map((key) => ({
      key,
      server: valueLabel(server[key], Object.hasOwn(server, key)),
      incoming: valueLabel(incoming[key], Object.hasOwn(incoming, key)),
    }))
}

function operationIds(conflict: SyncConflict): string[] {
  if (Array.isArray(conflict.competing_operations)) return conflict.competing_operations
  try {
    const value: unknown = JSON.parse(conflict.competing_operations)
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

export function SyncConflictsPage() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')
  const [notice, setNotice] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [resolutionFilter, setResolutionFilter] = useState<'ALL' | 'unresolved' | 'resolved'>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<SyncConflict[]>('/sync-conflicts')
      if (!Array.isArray(data)) throw new Error('The API returned an unexpected conflict list.')
      setConflicts(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conflict records are unavailable.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = async (conflict: SyncConflict, resolution: 'accepted_server' | 'accepted_incoming') => {
    const choice = resolution === 'accepted_server' ? 'keep the authoritative server record' : 'apply the incoming field mutation'
    if (!window.confirm(`Resolve this ${formatStatusLabel(conflict.entity_type)} conflict and ${choice}?`)) return
    setWorkingId(conflict.conflict_id)
    setError('')
    setNotice('')
    try {
      const response = await apiPatch<SyncConflict>(`/sync-conflicts/${conflict.conflict_id}/resolve`, { resolution })
      let confirmed = response?.resolution === resolution ? response : null
      if (!confirmed) {
        const current = await apiGet<SyncConflict>(`/sync-conflicts/${conflict.conflict_id}`)
        if (current?.resolution !== resolution)
          throw new Error('The backend did not confirm that this conflict was resolved.')
        confirmed = current
      }
      await load()
      setConflicts((current) =>
        current.map((item) =>
          item.conflict_id === conflict.conflict_id
            ? { ...item, ...confirmed, operation_details: item.operation_details }
            : item,
        ),
      )
      setNotice(`Backend confirmed resolution: ${formatStatusLabel(resolution)}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conflict resolution failed.')
    } finally {
      setWorkingId('')
    }
  }

  // Filtered
  const filteredConflicts = useMemo(() => {
    return conflicts.filter((c) => {
      const isResolved = Boolean(c.resolution)
      if (resolutionFilter === 'unresolved' && isResolved) return false
      if (resolutionFilter === 'resolved' && !isResolved) return false
      if (!searchTerm) return true
      const s = searchTerm.toLowerCase()
      const entity = (c.entity_type || '').toLowerCase()
      const entityId = (c.entity_id || '').toLowerCase()
      const conflictId = (c.conflict_id || '').toLowerCase()
      return entity.includes(s) || entityId.includes(s) || conflictId.includes(s)
    })
  }, [conflicts, resolutionFilter, searchTerm])

  // KPIs
  const kpis = useMemo(() => {
    const total = conflicts.length
    const unresolved = conflicts.filter((c) => !c.resolution).length
    const serverAccepted = conflicts.filter((c) => c.resolution === 'accepted_server').length
    const incomingAccepted = conflicts.filter((c) => c.resolution === 'accepted_incoming').length
    return { total, unresolved, serverAccepted, incomingAccepted }
  }, [conflicts])

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">DISTRIBUTED RECONCILIATION · CONFLICT REVIEW</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>Sync Conflicts</h2>
          <p className="page-subtitle">
            Side-by-side reconciliation between authoritative server records and concurrent mutations submitted by disconnected field clients.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading || !!workingId}>
            Refresh Conflicts
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Conflict Metrics">
        <div className="kpi-card">
          <span className="kpi-label">TOTAL CONFLICTS</span>
          <span className="kpi-value">{kpis.total}</span>
          <span className="kpi-hint">Historical & active</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">UNRESOLVED</span>
          <span className="kpi-value alert">{kpis.unresolved}</span>
          <span className="kpi-hint">Requires operator decision</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">SERVER ACCEPTED</span>
          <span className="kpi-value info">{kpis.serverAccepted}</span>
          <span className="kpi-hint">Server record retained</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">INCOMING ACCEPTED</span>
          <span className="kpi-value success">{kpis.incomingAccepted}</span>
          <span className="kpi-hint">Field mutation adopted</span>
        </div>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button type="button" className="btn-link" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {notice && (
        <div className="notice-banner" role="status">
          {notice}
        </div>
      )}

      {/* Main Container */}
      <section className="panel">
        <div className="operational-toolbar">
          <div className="filter-group">
            <label htmlFor="conflict-search" className="sr-only">
              Search conflicts
            </label>
            <input
              id="conflict-search"
              type="search"
              className="text-input filter-search"
              placeholder="Search by entity type or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <span className="filter-label">Filter:</span>
            <div className="btn-group">
              {(['ALL', 'unresolved', 'resolved'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`btn-filter ${resolutionFilter === tab ? 'active' : ''}`}
                  onClick={() => setResolutionFilter(tab)}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="data-note" role="status">
            Loading conflict ledger...
          </p>
        ) : filteredConflicts.length === 0 ? (
          <EmptyState
            message={
              conflicts.length === 0
                ? 'No synchronization conflicts recorded in the backend ledger.'
                : 'No conflicts match the active filter criteria.'
            }
          />
        ) : (
          <div className="conflict-stack">
            {filteredConflicts.map((conflict) => {
              const server = objectValue(conflict.server_value)
              const operations = conflict.operation_details ?? []
              const ids = operationIds(conflict)
              const unresolved = !conflict.resolution

              return (
                <article
                  key={conflict.conflict_id}
                  className={`panel conflict-resolution-card ${unresolved ? 'conflict-active' : 'conflict-resolved'}`}
                >
                  <div className="panel-header conflict-card-header">
                    <div>
                      <div className="page-title-row">
                        <span className="badge-tag">{formatStatusLabel(conflict.entity_type)}</span>
                        <code className="code-badge">ID: {conflict.conflict_id}</code>
                      </div>
                      <h3>
                        <RecordReference label={recordName(server, conflict.entity_type, conflict.entity_id)} />
                      </h3>
                    </div>
                    <StatusPill status={conflict.resolution || 'pending review'} />
                  </div>

                  {/* Summary Grid */}
                  <div className="conflict-metadata-grid">
                    <div>
                      <span className="kpi-label">TARGET RECORD</span>
                      <span className="detail-value">{recordLabel(null, conflict.entity_id)}</span>
                    </div>
                    <div>
                      <span className="kpi-label">SERVER VERSION</span>
                      <span className="detail-value">v{conflict.server_version ?? '1'}</span>
                    </div>
                    <div>
                      <span className="kpi-label">COMPETING MUTATIONS</span>
                      <span className="detail-value">{ids.length || operations.length}</span>
                    </div>
                    <div>
                      <span className="kpi-label">RESOLUTION STATUS</span>
                      <span className="detail-value">{formatStatusLabel(conflict.resolution || 'Pending review')}</span>
                    </div>
                    {conflict.resolved_at && (
                      <div>
                        <span className="kpi-label">RESOLVED AT</span>
                        <Timestamp value={conflict.resolved_at} compact />
                      </div>
                    )}
                    {conflict.resolved_by && (
                      <div>
                        <span className="kpi-label">RESOLVED BY</span>
                        <span className="detail-value">{recordLabel(null, conflict.resolved_by)}</span>
                      </div>
                    )}
                  </div>

                  {/* Side by side comparison for each competing operation */}
                  {operations.length > 0 ? (
                    operations.map((operation) => {
                      const incoming = objectValue(operation.payload)
                      const diffs = differences(server, incoming)

                      return (
                        <div key={operation.op_id} className="competing-op-container">
                          <div className="op-summary-header">
                            <div>
                              <strong>Field Operation: {recordLabel(null, operation.op_id)}</strong>
                              <span className="text-secondary">
                                &nbsp;· {formatStatusLabel(operation.operation_type)} · Device: {operation.device_id || 'Direct client'} · Base v{operation.base_version ?? '0'}
                              </span>
                            </div>
                            <span className="diff-count-badge">{diffs.length} Changed fields</span>
                          </div>

                          {diffs.length > 0 ? (
                            <div className="table-scroll">
                              <table className="dense-table side-by-side-table" aria-label="Field Comparison">
                                <thead>
                                  <tr>
                                    <th style={{ width: '25%' }}>Field Name</th>
                                    <th style={{ width: '35%' }} className="server-col-header">
                                      Authoritative Server State
                                    </th>
                                    <th style={{ width: '35%' }} className="incoming-col-header">
                                      Incoming Field State
                                    </th>
                                    <th style={{ width: '5%' }}>Diff</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {diffs.map((field) => (
                                    <tr key={field.key}>
                                      <td>
                                        <strong>{fieldLabel(field.key)}</strong>
                                      </td>
                                      <td className="server-cell">
                                        <code>{field.server}</code>
                                      </td>
                                      <td className="incoming-cell">
                                        <code>{field.incoming}</code>
                                      </td>
                                      <td className="text-center">
                                        <span className="diff-dot" title="Values differ">●</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="data-note">No field differences detected in this operation payload.</p>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="data-note">Incoming operation details were not returned by the backend.</p>
                  )}

                  {/* Resolution Action Bar */}
                  {unresolved ? (
                    <div className="conflict-action-bar">
                      <p className="form-note">
                        Select which state should be permanently committed to the canonical database:
                      </p>
                      <div className="btn-group">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={Boolean(workingId)}
                          onClick={() => void resolve(conflict, 'accepted_server')}
                        >
                          {workingId === conflict.conflict_id ? 'Resolving…' : 'Keep Server Value'}
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={Boolean(workingId)}
                          onClick={() => void resolve(conflict, 'accepted_incoming')}
                        >
                          {workingId === conflict.conflict_id ? 'Resolving…' : 'Apply Incoming Field Value'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="resolved-notice">
                      ✓ Confirmed Resolution: <strong>{formatStatusLabel(conflict.resolution)}</strong>
                      {conflict.resolved_by && <span> by {recordLabel(null, conflict.resolved_by)}</span>}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

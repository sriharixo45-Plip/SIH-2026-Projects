import { useEffect, useState } from 'react'
import type { SyncOperation } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { TechnicalDetails } from '../components/common/TechnicalDetails'
import { Timestamp } from '../components/common/Timestamp'
import { RecordReference } from '../components/common/RecordReference'
import { apiGet, apiPatch, ApiError } from '../services/api'
import { safeReference } from '../utils/display'
import { ErrorBanner } from '../components/common/ErrorBanner'

const operationLabel = (value?: string | null) => {
  const label = formatStatusLabel(value)
  return label === 'Unknown' ? 'Operation' : label
}
const recordName = (payload: unknown, entityType?: string | null) => {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
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
  const [errorDetails, setErrorDetails] = useState<{ status?: number; endpoint?: string; requestId?: string; body?: string }>()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const fetchSyncOps = async () => {
    setLoading(true); setError(''); setErrorDetails(undefined)
    try { const data = await apiGet<SyncOperation[]>('/sync-operations'); if (!Array.isArray(data)) throw new Error('The API returned an unexpected sync data format.'); setSyncOps(data) }
    catch (e) { setSyncOps([]); setError(e instanceof Error ? e.message : 'Sync operation records unavailable.'); if (e instanceof ApiError) setErrorDetails({ status: e.status, endpoint: e.endpoint, requestId: e.requestId, body: e.technicalDetails }) }
    finally { setLoading(false) }
  }
  useEffect(() => { void fetchSyncOps() }, [])
  const act = async (id: string, action: 'apply' | 'reject') => {
    setProcessingId(id); setError(''); setErrorDetails(undefined)
    try { await apiPatch(`/sync-operations/${id}/${action}`, {}); await fetchSyncOps() }
    catch (e) { setError(e instanceof Error ? e.message : `Unable to ${action} operation.`); if (e instanceof ApiError) setErrorDetails({ status: e.status, endpoint: e.endpoint, requestId: e.requestId, body: e.technicalDetails }) }
    finally { setProcessingId(null) }
  }
  return <div className="page-container"><section className="panel">
    <div className="panel-header"><div><p className="eyebrow">SERVER-SIDE SYNC OPERATIONS</p><h2>{error ? 'Sync data unavailable' : `Field operation records (${syncOps.length})`}</h2><p className="data-note">Accepted field operations are applied transactionally. Version conflicts retain the authoritative server state for review.</p></div><button type="button" className="btn-secondary" onClick={() => void fetchSyncOps()} disabled={loading}>Refresh</button></div>
    {error && <ErrorBanner message={error} details={errorDetails} onRetry={() => void fetchSyncOps()} />}
    {loading ? <p className="data-note" role="status">Loading server sync records…</p> : error ? <div className="unavailable-state" role="status">Sync records could not be loaded.</div> : syncOps.length === 0 ? <EmptyState message="No sync operation records returned by the API." /> : <div className="table-scroll"><table className="operations-table"><thead><tr><th>Operation</th><th>Record</th><th>Status</th><th>Time</th><th>Action</th></tr></thead><tbody>{syncOps.map((op) => {
      const status = (op.status || 'unknown').toLowerCase(); const pending = status === 'pending'
      const target = safeReference(op.target_entity_id, '')
      return <tr key={op.op_id}>
        <td><span className="table-primary">{operationLabel(op.operation_type)}</span><TechnicalDetails fields={[{ label: 'Operation ID', value: op.op_id }, { label: 'Sequence', value: op.local_sequence_number ?? 'Not provided' }]} /></td>
        <td><RecordReference label={recordName(op.payload, op.target_entity_type)} /><TechnicalDetails fields={[{ label: 'Record ID', value: op.target_entity_id }, { label: 'Entity type', value: op.target_entity_type || 'Not provided' }, { label: 'Reference', value: target || undefined }]} /></td>
        <td><StatusPill status={status} /></td>
        <td><Timestamp value={op.applied_at || op.local_timestamp} compact /></td>
        <td><div className="operation-row-actions">{pending ? <div className="btn-group"><button className="btn-primary-sm" type="button" disabled={processingId === op.op_id} onClick={() => void act(op.op_id, 'apply')}>Apply</button><button className="btn-danger-sm" type="button" disabled={processingId === op.op_id} onClick={() => void act(op.op_id, 'reject')}>Reject</button></div> : <span className="data-note">No action</span>}
          <TechnicalDetails fields={[{ label: 'Device ID', value: op.device_id }, { label: 'Actor ID', value: op.performed_by }, { label: 'Base version', value: op.base_version ?? 'Not provided' }, { label: 'Full timestamp', value: op.applied_at || op.local_timestamp }]}><pre className="payload-preview">{JSON.stringify(op.payload ?? 'Payload unavailable', null, 2)}</pre></TechnicalDetails>
          <details className="technical-details"><summary>Conflict details</summary><p className="data-note">Review the Conflicts page for the related server and incoming values.</p></details>
        </div></td>
      </tr>
    })}</tbody></table></div>}
  </section></div>
}

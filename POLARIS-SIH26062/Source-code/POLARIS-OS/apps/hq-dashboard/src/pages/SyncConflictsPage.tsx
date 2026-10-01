import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../services/api'
import { EmptyState } from '../components/common/EmptyState'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { TechnicalDetails } from '../components/common/TechnicalDetails'
import { Timestamp } from '../components/common/Timestamp'
import { RecordReference } from '../components/common/RecordReference'
import { recordLabel } from '../utils/display'

type OperationDetail = { op_id: string; device_id?: string | null; performed_by?: string | null; local_sequence_number?: number | null; operation_type?: string | null; payload?: unknown; base_version?: number | null; local_timestamp?: string | null; status?: string | null }
type SyncConflict = { conflict_id: string; entity_type: string; entity_id: string; competing_operations: string[] | string; operation_details?: OperationDetail[] | null; server_value?: unknown; resolution?: string | null; resolved_by?: string | null; resolved_at?: string | null }
const objectValue = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {}
const valueFor = (value: unknown, key: string) => { const item = objectValue(value)[key]; return item == null ? 'Not available' : typeof item === 'object' ? JSON.stringify(item) : String(item) }
const recordName = (value: unknown, entityType: string, id: string) => {
  const data = objectValue(value); const code = data.code || data.expedition_code || data.leg_code || data.tracking_code; const name = data.name || data.expedition_name || data.description || data.item_name
  if (code && name) return `${String(code)} — ${String(name)}`
  if (code || name) return String(code || name)
  return `${formatStatusLabel(entityType)} · ${recordLabel(null, id)}`
}
function changedFieldNames(server: unknown, incoming: unknown): string[] { const current = objectValue(server); const next = objectValue(incoming); return [...new Set([...Object.keys(current), ...Object.keys(next)])].filter((key) => JSON.stringify(current[key]) !== JSON.stringify(next[key])) }

export function SyncConflictsPage() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [workingId, setWorkingId] = useState(''); const [notice, setNotice] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await apiGet<SyncConflict[]>('/sync-conflicts'); if (!Array.isArray(data)) throw new Error('The API returned an unexpected conflict list.'); setConflicts(data) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Conflict records are unavailable.') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const resolve = async (conflict: SyncConflict, resolution: 'accepted_server' | 'accepted_incoming') => {
    const choice = resolution === 'accepted_server' ? 'keep the current server value' : 'apply the incoming field value to the current server record'
    if (!window.confirm(`Resolve this ${formatStatusLabel(conflict.entity_type)} conflict and ${choice}? This decision is recorded in the backend audit log.`)) return
    setWorkingId(conflict.conflict_id); setError(''); setNotice('')
    try { await apiPatch(`/sync-conflicts/${conflict.conflict_id}/resolve`, { resolution }); setNotice(`Conflict ${recordLabel(null, conflict.conflict_id)} resolved: ${resolution === 'accepted_server' ? 'server value kept' : 'incoming value applied'}.`); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Conflict resolution failed.') } finally { setWorkingId('') }
  }
  return <div className="page-container"><section className="panel">
    <div className="panel-header"><div><p className="eyebrow">OFFLINE SYNCHRONIZATION</p><h2>Conflicts requiring review</h2><p className="data-note">Compare the server value with incoming operation payloads. Resolution is transactional and audited.</p></div><button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading || !!workingId}>Refresh</button></div>
    {error && <div className="error-banner" role="alert">{error}<button type="button" className="btn-link" onClick={() => void load()}>Retry</button></div>}{notice && <div className="notice-banner" role="status">{notice}</div>}
    {loading ? <p className="data-note" role="status">Loading conflict records…</p> : conflicts.length === 0 ? <EmptyState message="No synchronization conflicts have been recorded." /> : <div className="conflict-list">{conflicts.map((conflict) => {
      const operations = conflict.operation_details ?? []; const incoming = operations[0]; const changed = changedFieldNames(conflict.server_value, incoming?.payload); const unresolved = !conflict.resolution; const operationIds = Array.isArray(conflict.competing_operations) ? conflict.competing_operations : []
      return <article className="panel conflict-card" key={conflict.conflict_id}>
        <div className="panel-header"><div><p className="eyebrow">CONFLICT</p><h3><RecordReference label={recordName(conflict.server_value, conflict.entity_type, conflict.entity_id)} /></h3></div><StatusPill status={conflict.resolution || 'conflict'} /></div>
        <div className="conflict-values conflict-summary-grid">
          <div><h4>Server value</h4><p><strong>Status:</strong> {valueFor(conflict.server_value, 'status')}</p></div>
          <div><h4>Incoming change</h4><p><strong>Status:</strong> {valueFor(incoming?.payload, 'status')}</p></div>
          <div><h4>Result</h4><p>{formatStatusLabel(conflict.resolution || 'unresolved')}</p></div>
        </div>
        <p className="data-note">Changed fields: {changed.length}{conflict.resolved_at ? <> · Resolved <Timestamp value={conflict.resolved_at} compact /></> : null}</p>
        <TechnicalDetails fields={[{ label: 'Conflict ID', value: conflict.conflict_id }, { label: 'Record ID', value: conflict.entity_id }, { label: 'Entity type', value: conflict.entity_type }, { label: 'Resolved by', value: conflict.resolved_by }, { label: 'Competing operation IDs', value: operationIds.join(', ') || operations.map((op) => op.op_id).join(', ') || 'Not provided' }]}>
          <h4>Server payload</h4><pre className="payload-preview">{JSON.stringify(conflict.server_value ?? 'Value unavailable', null, 2)}</pre>
          {operations.map((op) => <div key={op.op_id} className="conflict-technical-operation"><h4>Incoming operation</h4><p>Operation: {op.operation_type || 'Not provided'} · sequence {op.local_sequence_number ?? 'Not provided'} · base version {op.base_version ?? 'Not provided'} · <Timestamp value={op.local_timestamp} compact /></p><pre className="payload-preview">{JSON.stringify(op.payload ?? 'Payload unavailable', null, 2)}</pre><p>Device {op.device_id || 'Not provided'} · Actor {op.performed_by || 'Not provided'} · Status {op.status || 'Not provided'}</p></div>)}
        </TechnicalDetails>
        {unresolved ? <div className="btn-group conflict-actions"><button type="button" className="btn-secondary" disabled={!!workingId} onClick={() => void resolve(conflict, 'accepted_server')}>{workingId === conflict.conflict_id ? 'Resolving…' : 'Keep server value'}</button><button type="button" className="btn-primary" disabled={!!workingId} onClick={() => void resolve(conflict, 'accepted_incoming')}>{workingId === conflict.conflict_id ? 'Resolving…' : 'Apply incoming value'}</button></div> : <p className="data-note">Resolved by {recordLabel(null, conflict.resolved_by)}</p>}
      </article>
    })}</div>}
  </section></div>
}

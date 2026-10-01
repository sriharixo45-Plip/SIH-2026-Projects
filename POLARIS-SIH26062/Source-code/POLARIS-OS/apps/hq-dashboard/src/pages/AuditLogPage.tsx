import { useEffect, useMemo, useState } from 'react'
import type { AuditLog } from '../types'
import { apiGet, ApiError } from '../services/api'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorBanner } from '../components/common/ErrorBanner'
import { TechnicalDetails } from '../components/common/TechnicalDetails'
import { Timestamp } from '../components/common/Timestamp'
import { formatStatusLabel } from '../components/common/StatusPill'
import { recordLabel, safeReference } from '../utils/display'

const actionLabel = (action: string) => {
  const normalized = action.toLowerCase().replace(/[._-]+/g, ' ').trim()
  if (normalized === 'status change' || normalized === 'status changed') return 'Status changed'
  if (normalized === 'create' || normalized === 'created') return 'Record created'
  if (normalized === 'update' || normalized === 'updated') return 'Record updated'
  if (normalized === 'delete' || normalized === 'deleted') return 'Record deleted'
  return formatStatusLabel(normalized)
}
export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [errorDetails, setErrorDetails] = useState<{ status?: number; endpoint?: string; requestId?: string; body?: string }>(); const [query, setQuery] = useState('')
  const load = async () => { setLoading(true); setError(''); setErrorDetails(undefined); try { const data = await apiGet<AuditLog[]>('/audit-logs'); if (!Array.isArray(data)) throw new Error('The API returned an unexpected audit data format.'); setLogs(data) } catch (e) { setLogs([]); setError(e instanceof Error ? e.message : 'Canonical audit records unavailable.'); if (e instanceof ApiError) setErrorDetails({ status: e.status, endpoint: e.endpoint, requestId: e.requestId, body: e.technicalDetails }) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => { const q = query.toLowerCase(); return logs.filter((row) => [row.actor, row.actor_user?.full_name, row.action, row.entity_type, row.entity_id, row.device_id, row.sync_origin, row.reason].some((v) => String(v || '').toLowerCase().includes(q))) }, [logs, query])
  return <div className="page-container"><section className="panel"><div className="panel-header"><div><p className="eyebrow">CANONICAL BACKEND RECORDS</p><h2>{error ? 'Audit data unavailable' : `Audit log (${filtered.length})`}</h2></div><label className="search-label">Search <input className="text-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Actor, action, entity…" /></label></div>
    {error ? <ErrorBanner message="Audit activity could not be loaded." details={errorDetails} onRetry={() => void load()} /> : loading ? <p className="data-note" role="status">Loading audit records…</p> : filtered.length === 0 ? <EmptyState message={logs.length ? 'No audit records match this search.' : 'The canonical audit endpoint returned no records.'} /> : <div className="table-scroll"><table><thead><tr><th>Activity</th><th>Record</th><th>Time (IST)</th><th>Details</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.log_id}>
      <td>{actionLabel(row.action)}</td><td>{formatStatusLabel(row.entity_type)} · {recordLabel(null, row.entity_id)}</td><td><Timestamp value={row.timestamp_utc} compact /></td>
      <td><span className="table-subtext">Actor: {safeReference(row.actor_user?.full_name || row.actor, 'Not provided')} · Source: {formatStatusLabel(row.sync_origin || (row.device_id ? 'device' : 'Not provided'))}</span>{row.reason && <span className="table-subtext">Reason: {row.reason}</span>}<TechnicalDetails fields={[{ label: 'Log ID', value: row.log_id }, { label: 'Entity ID', value: row.entity_id }, { label: 'Actor ID', value: row.actor }, { label: 'Device ID', value: row.device_id }, { label: 'Source', value: row.sync_origin }, { label: 'Full timestamp', value: row.timestamp_utc }]} /></td>
    </tr>)}</tbody></table></div>}
  </section></div>
}

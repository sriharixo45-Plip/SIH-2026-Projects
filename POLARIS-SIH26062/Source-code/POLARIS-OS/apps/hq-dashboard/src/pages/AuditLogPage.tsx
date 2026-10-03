import { useEffect, useMemo, useState } from 'react'
import type { AuditLog } from '../types'
import { apiGet, ApiError } from '../services/api'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorBanner } from '../components/common/ErrorBanner'
import { TechnicalDetails } from '../components/common/TechnicalDetails'
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
  if (['create', 'created'].includes(normalized) || normalized.endsWith(' create')) return `${entity ? formatStatusLabel(entity) : 'Record'} created`
  if (['update', 'updated'].includes(normalized) || normalized.endsWith(' update')) return `${entity ? formatStatusLabel(entity) : 'Record'} updated`
  if (['delete', 'deleted'].includes(normalized)) return `${entity ? formatStatusLabel(entity) : 'Record'} deleted`
  return normalized ? formatStatusLabel(normalized) : 'No action'
}

const knownLabels: Record<string, string> = {
  cargoid: 'Cargo ID', trackingcode: 'Tracking code', returncargo: 'Return cargo', weightkg: 'Weight (kg)', volumem3: 'Volume (m³)',
  incidentid: 'Incident ID', employeeid: 'Employee ID', employeecode: 'Employee ID', roleid: 'Role ID', stationid: 'Station ID',
  operationid: 'Operation ID', expeditionid: 'Expedition ID', syncstatus: 'Sync status', deviceid: 'Device ID', baseversion: 'Base version',
}
function labelFor(key: string) { const compact = key.toLowerCase().replace(/[^a-z0-9]/g, ''); return knownLabels[compact] || formatStatusLabel(key.replace(/_/g, ' ')) }
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') { try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null } catch { return null } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function readable(value: unknown): string { if (value == null || value === '') return 'Not available'; if (typeof value === 'boolean') return value ? 'Yes' : 'No'; return typeof value === 'object' ? JSON.stringify(value) : String(value) }

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorDetails, setErrorDetails] = useState<{ status?: number; endpoint?: string; requestId?: string; body?: string }>()
  const [query, setQuery] = useState('')
  const load = async () => {
    setLoading(true); setError(''); setErrorDetails(undefined)
    try { const data = await apiGet<AuditLog[]>('/audit-logs'); if (!Array.isArray(data)) throw new Error('The API returned an unexpected audit data format.'); setLogs(data) }
    catch (cause) { setLogs([]); setError(cause instanceof Error ? cause.message : 'Canonical audit records unavailable.'); if (cause instanceof ApiError) setErrorDetails({ status: cause.status, endpoint: cause.endpoint, requestId: cause.requestId, body: cause.technicalDetails }) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => { const q = query.toLowerCase(); return logs.filter((row) => [row.actor, row.actor_user?.full_name, row.action, row.entity_type, row.entity_id, row.device_id, row.sync_origin, row.reason].some((value) => String(value || '').toLowerCase().includes(q))) }, [logs, query])
  return <div className="page-container"><section className="panel"><div className="panel-header"><div><p className="eyebrow">CANONICAL BACKEND RECORDS · API</p><h2>{error ? 'Audit data unavailable' : `Audit log (${filtered.length})`}</h2></div><label className="search-label">Search <input className="text-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Actor, action, entity…" /></label></div>
    {error ? <ErrorBanner message="Audit activity could not be loaded." details={errorDetails} onRetry={() => void load()} /> : loading ? <p className="data-note" role="status">Loading audit records…</p> : filtered.length === 0 ? <EmptyState message={logs.length ? 'No audit records match this search.' : 'The canonical audit endpoint returned no records.'} /> : <div className="table-scroll"><table><thead><tr><th>Activity</th><th>Record</th><th>Time (IST)</th><th>Details</th></tr></thead><tbody>{filtered.map((row) => {
      const before = asRecord(row.old_value); const after = asRecord(row.new_value); const combined = { ...(before || {}), ...(after || {}) }
      const baseVersion = combined.base_version ?? combined.baseVersion ?? combined.version
      const recordFields = Object.entries(combined).filter(([key]) => !['base_version', 'baseversion', 'version'].includes(key.toLowerCase().replace(/[^a-z]/g, ''))).map(([key, value]) => ({ label: labelFor(key), value: readable(value) }))
      const rawPayload = { old_value: row.old_value ?? null, new_value: row.new_value ?? null }
      return <tr key={row.log_id}>
        <td>{actionLabel(row.action || '', row.entity_type)}</td><td>{formatStatusLabel(row.entity_type)} · {recordLabel(null, row.entity_id)}</td><td><Timestamp value={row.timestamp_utc} compact /></td>
        <td><span className="table-subtext">Actor: {safeReference(row.actor_user?.full_name || row.actor, 'Not provided')} · Source: {formatStatusLabel(row.sync_origin || (row.device_id ? 'device' : 'Not provided'))}</span>{row.reason && <span className="table-subtext">Reason: {row.reason}</span>}
          <TechnicalDetails summary="View technical details" fields={[{ label: 'Log ID', value: row.log_id }, { label: 'Entity ID', value: row.entity_id }, { label: 'Actor ID', value: row.actor }, { label: 'Device ID', value: row.device_id }, { label: 'Source', value: row.sync_origin }, { label: 'Base version', value: baseVersion == null ? undefined : readable(baseVersion) }, { label: 'Full timestamp', value: row.timestamp_utc }, ...recordFields]}>
            <details className="technical-details-raw"><summary>View raw payload</summary><pre>{JSON.stringify(rawPayload, null, 2)}</pre></details>
          </TechnicalDetails>
        </td>
      </tr>
    })}</tbody></table></div>}
  </section></div>
}

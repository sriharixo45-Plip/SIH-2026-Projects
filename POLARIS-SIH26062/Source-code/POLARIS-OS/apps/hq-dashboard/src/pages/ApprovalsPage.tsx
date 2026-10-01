import { useEffect, useState } from 'react'
import type { Approval } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiGet, apiPost, ApiError } from '../services/api'
import { formatDateTime, recordLabel, safeReference, redactDatabaseIds } from '../utils/display'
import { ErrorBanner } from '../components/common/ErrorBanner'
type Props = { onRefresh: () => void; currentUserId?: string; currentRole?: string | null }
export function ApprovalsPage({ onRefresh, currentUserId, currentRole }: Props) {
  const [approvals, setApprovals] = useState<Approval[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [errorDetails, setErrorDetails] = useState<{ status?: number; endpoint?: string; requestId?: string; body?: string }>(); const [reasons, setReasons] = useState<Record<string, string>>({})
  const load = async () => { setLoading(true); setError(''); setErrorDetails(undefined); try { const data = await apiGet<Approval[]>('/approvals'); if (!Array.isArray(data)) throw new Error('The API returned an unexpected approval data format.'); setApprovals(data) } catch (e) { setError(e instanceof Error ? e.message : 'Approvals unavailable.'); if (e instanceof ApiError) setErrorDetails({ status: e.status, endpoint: e.endpoint, requestId: e.requestId, body: e.technicalDetails }) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const decide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    if (!currentUserId) { setError('Authenticated user identity is not available.'); return }
    if (!reasons[approvalId]?.trim()) { setError('Enter a decision reason before recording a decision.'); return }
    setError('')
    try { await apiPost(`/approvals/${approvalId}/decide`, { decision, reason: reasons[approvalId].trim() }); setReasons((old) => ({ ...old, [approvalId]: '' })); await load(); onRefresh() }
    catch (e) { setError(e instanceof ApiError && e.status === 403 ? 'The server rejected this decision as unauthorized.' : e instanceof Error ? e.message : 'Unable to record decision.'); if (e instanceof ApiError) setErrorDetails({ status: e.status, endpoint: e.endpoint, requestId: e.requestId, body: e.technicalDetails }) }
  }
  return <div className="page-container"><section className="panel"><div className="panel-header"><div><p className="eyebrow">FORMAL DECISIONS</p><h2>{error ? 'Approval data unavailable' : `Approvals (${approvals.length})`}</h2></div></div>
    {error && <ErrorBanner message={error} details={errorDetails} onRetry={() => void load()} />}
    {loading ? <p className="data-note" role="status">Loading approval records...</p> : error ? <div className="unavailable-state" role="status">Approval records unavailable. {error}</div> : approvals.length === 0 ? <EmptyState message="No approval records returned by the API." /> : <div className="table-scroll"><table><thead><tr><th>Action / entity</th><th>Requester</th><th>Required authority</th><th>Status</th><th>Created</th><th>Decision</th></tr></thead><tbody>{approvals.map((row) => { const state = (row.decision || row.status || 'pending').toLowerCase(); const pending = state === 'pending'; return <tr key={row.approval_id}><td>{formatStatusLabel(row.entity_type)}<small className="table-subtext">{recordLabel(null, row.entity_id, 'Entity not provided')}</small></td><td>{safeReference(row.requested_by)}</td><td>Not provided by API</td><td><StatusPill status={state} /></td><td>Not provided by API</td><td>{pending ? <div className="approval-actions"><label className="sr-only" htmlFor={`reason-${row.approval_id}`}>Decision reason for {recordLabel(null, row.approval_id)}</label><textarea id={`reason-${row.approval_id}`} className="textarea-input" placeholder="Decision reason (required)" value={reasons[row.approval_id] || ''} onChange={(event) => setReasons((old) => ({ ...old, [row.approval_id]: event.target.value }))} /><p className="authority-note">Your role: {recordLabel(currentRole, undefined, 'Not provided')} - Decision unavailable: API does not provide authority eligibility. Server authorization remains authoritative.</p><div className="btn-group"><button type="button" className="btn-primary-sm" disabled={loading || !reasons[row.approval_id]?.trim()} onClick={() => void decide(row.approval_id, 'approved')}>Approve</button><button type="button" className="btn-danger-sm" disabled={loading || !reasons[row.approval_id]?.trim()} onClick={() => void decide(row.approval_id, 'rejected')}>Reject</button></div></div> : <div>{redactDatabaseIds(row.reason || row.comments || 'Decision reason not provided')}<small className="table-subtext">{safeReference(row.decided_by, 'Decision maker not provided')} - {row.decided_at && !Number.isNaN(Date.parse(row.decided_at)) ? formatDateTime(row.decided_at, true) : 'Decision time unavailable'}</small></div>}</td></tr> })}</tbody></table></div>}
  </section></div>
}




import { useEffect, useState } from 'react'
import type { Approval, Recommendation } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { TechnicalDetails } from '../components/common/TechnicalDetails'
import { Timestamp } from '../components/common/Timestamp'
import { redactDatabaseIds } from '../utils/display'
import { apiGet, apiPost, ApiError } from '../services/api'

type Props = { recommendations: Recommendation[]; dataError?: string; onNavigate: (route: string) => void; currentUserId?: string; onRefresh?: () => void }
function recommendationText(value: Recommendation['proposed_change']) {
  if (typeof value === 'string') return redactDatabaseIds(value)
  if (value && typeof value === 'object') return redactDatabaseIds(String(value.recommendation ?? value.action ?? JSON.stringify(value)))
  return 'Recommendation details not provided.'
}
export function RecommendationsPage({ recommendations, dataError, onNavigate, currentUserId, onRefresh }: Props) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [requestingId, setRequestingId] = useState('')
  const [reasonById, setReasonById] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  useEffect(() => { apiGet<Approval[]>('/approvals').then((rows) => setApprovals(Array.isArray(rows) ? rows : [])).catch(() => setApprovals([])) }, [])
  const requestApproval = async (recommendation: Recommendation) => {
    if (!currentUserId || !recommendation.recommendation_id) { setActionError('An authenticated user and backend recommendation ID are required.'); return }
    const reason = reasonById[recommendation.recommendation_id]?.trim()
    if (!reason) { setActionError('Enter the reason for requesting human approval.'); return }
    setRequestingId(recommendation.recommendation_id); setActionError(''); setActionNotice('')
    try {
      await apiPost('/approvals', { entity_type: 'recommendation', entity_id: recommendation.recommendation_id, requested_by: currentUserId, reason })
      setActionNotice('Approval request saved. A different authorized user can decide it on the Approvals page.')
      setReasonById((old) => ({ ...old, [recommendation.recommendation_id!]: '' }))
      const rows = await apiGet<Approval[]>('/approvals'); setApprovals(Array.isArray(rows) ? rows : []); onRefresh?.()
    } catch (cause) { setActionError(cause instanceof ApiError && cause.status === 403 ? 'The server denied this approval request.' : cause instanceof Error ? cause.message : 'Approval request could not be saved.') }
    finally { setRequestingId('') }
  }
  return <div className="page-container"><section className="panel"><div className="panel-header"><div><p className="eyebrow">BACKEND RECOMMENDATION RECORDS</p><h2>Recommendations ({recommendations.length})</h2></div></div>
    {actionError && <div className="error-banner" role="alert">{actionError}</div>}{actionNotice && <div className="notice-banner" role="status">{actionNotice}</div>}
    {dataError ? <div className="unavailable-state" role="status">Recommendation data unavailable. {dataError}</div> : !recommendations.length ? <EmptyState message="No recommendation records returned by the API." /> : <div className="table-scroll"><table><thead><tr><th>Recommendation</th><th>Reason / constraints</th><th>Source</th><th>Status</th><th>Created</th><th>Approval</th></tr></thead><tbody>{recommendations.map((rec, index) => <tr key={rec.recommendation_id || index}>
      <td><strong>{formatStatusLabel(rec.recommendation_type)}</strong><small className="table-subtext">{recommendationText(rec.proposed_change)}</small><TechnicalDetails fields={[{ label: 'Recommendation ID', value: rec.recommendation_id }, { label: 'Trigger ID', value: rec.trigger_id }]} /></td>
      <td>{rec.constraint_basis || 'Reason not provided by API'}</td><td>{formatStatusLabel(rec.trigger_type || 'Source unavailable')}</td><td><StatusPill status={rec.status} /></td><td><Timestamp value={rec.generated_at} compact /></td>
      <td>{rec.recommendation_id && (rec.approval_id || approvals.some((approval) => approval.entity_type === 'recommendation' && approval.entity_id === rec.recommendation_id)) ? <span className="authority-note">Approval request exists</span> : rec.recommendation_id ? <div className="approval-actions"><textarea className="textarea-input" aria-label={`Approval reason for recommendation ${rec.recommendation_id}`} placeholder="Reason for human approval" value={reasonById[rec.recommendation_id] || ''} onChange={(event) => setReasonById((old) => ({ ...old, [rec.recommendation_id!]: event.target.value }))} /><button type="button" className="btn-primary-sm" disabled={requestingId === rec.recommendation_id || !reasonById[rec.recommendation_id]?.trim()} onClick={() => void requestApproval(rec)}>{requestingId === rec.recommendation_id ? 'Saving…' : 'Request approval'}</button></div> : <span className="authority-note">Recommendation ID unavailable</span>}<button type="button" className="btn-link" onClick={() => onNavigate('approvals')}>View approval records</button></td>
    </tr>)}</tbody></table></div>}
  </section></div>
}

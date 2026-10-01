import type { Recommendation } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { TechnicalDetails } from '../components/common/TechnicalDetails'
import { Timestamp } from '../components/common/Timestamp'
import { redactDatabaseIds } from '../utils/display'

type Props = { recommendations: Recommendation[]; dataError?: string; onNavigate: (route: string) => void }
function recommendationText(value: Recommendation['proposed_change']) {
  if (typeof value === 'string') return redactDatabaseIds(value)
  if (value && typeof value === 'object') return redactDatabaseIds(String(value.recommendation ?? value.action ?? JSON.stringify(value)))
  return 'Recommendation details not provided.'
}
export function RecommendationsPage({ recommendations, dataError, onNavigate }: Props) {
  return <div className="page-container"><section className="panel"><div className="panel-header"><div><p className="eyebrow">BACKEND RECOMMENDATION RECORDS</p><h2>Recommendations ({recommendations.length})</h2></div></div>
    {dataError ? <div className="unavailable-state" role="status">Recommendation data unavailable. {dataError}</div> : !recommendations.length ? <EmptyState message="No recommendation records returned by the API." /> : <div className="table-scroll"><table><thead><tr><th>Recommendation</th><th>Reason / constraints</th><th>Source</th><th>Status</th><th>Created</th><th>Approval</th></tr></thead><tbody>{recommendations.map((rec, index) => <tr key={rec.recommendation_id || index}>
      <td><strong>{formatStatusLabel(rec.recommendation_type)}</strong><small className="table-subtext">{recommendationText(rec.proposed_change)}</small><TechnicalDetails fields={[{ label: 'Recommendation ID', value: rec.recommendation_id }, { label: 'Trigger ID', value: rec.trigger_id }]} /></td>
      <td>{rec.constraint_basis || 'Reason not provided by API'}</td><td>{formatStatusLabel(rec.trigger_type || 'Source unavailable')}</td><td><StatusPill status={rec.status} /></td><td><Timestamp value={rec.generated_at} compact /></td>
      <td><span className="authority-note">Approval: Not yet enabled</span><button type="button" className="btn-link" onClick={() => onNavigate('approvals')}>View approval records</button></td>
    </tr>)}</tbody></table></div>}
  </section></div>
}

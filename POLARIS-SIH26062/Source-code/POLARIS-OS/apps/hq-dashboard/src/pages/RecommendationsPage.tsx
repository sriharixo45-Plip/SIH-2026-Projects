import { useEffect, useMemo, useState } from 'react'
import type { Approval, Recommendation } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { TechnicalDetails } from '../components/common/TechnicalDetails'
import { Timestamp } from '../components/common/Timestamp'
import { redactDatabaseIds } from '../utils/display'
import { apiGet, apiPost, ApiError } from '../services/api'

type Props = {
  recommendations: Recommendation[]
  dataError?: string
  onNavigate: (route: string) => void
  currentUserId?: string
  onRefresh?: () => void
}

function recommendationText(value: Recommendation['proposed_change']) {
  if (typeof value === 'string') return redactDatabaseIds(value)
  if (value && typeof value === 'object') return redactDatabaseIds(String(value.recommendation ?? value.action ?? JSON.stringify(value)))
  return 'Recommendation details not provided.'
}

export function RecommendationsPage({ recommendations, dataError, onNavigate, currentUserId, onRefresh }: Props) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [approvalsError, setApprovalsError] = useState('')
  const [approvalsLoading, setApprovalsLoading] = useState(true)
  const [requestingId, setRequestingId] = useState('')
  const [reasonById, setReasonById] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadApprovals = async () => {
    setApprovalsLoading(true)
    setApprovalsError('')
    try {
      const rows = await apiGet<Approval[]>('/approvals')
      if (!Array.isArray(rows)) throw new Error('The API returned an unexpected approval data format.')
      setApprovals(rows)
    } catch (cause) {
      setApprovalsError(cause instanceof Error ? cause.message : 'Approval records are unavailable.')
    } finally {
      setApprovalsLoading(false)
    }
  }

  useEffect(() => {
    void loadApprovals()
  }, [])

  const requestApproval = async (recommendation: Recommendation) => {
    if (!currentUserId || !recommendation.recommendation_id) {
      setActionError('An authenticated user and backend recommendation ID are required.')
      return
    }
    const reason = reasonById[recommendation.recommendation_id]?.trim()
    if (!reason) {
      setActionError('Enter the reason for requesting human approval.')
      return
    }
    setRequestingId(recommendation.recommendation_id)
    setActionError('')
    setActionNotice('')
    try {
      await apiPost('/approvals', {
        entity_type: 'recommendation',
        entity_id: recommendation.recommendation_id,
        requested_by: currentUserId,
        reason,
      })
      setActionNotice('Approval request saved. A different authorized user can decide it on the Approvals page.')
      setReasonById((old) => ({ ...old, [recommendation.recommendation_id!]: '' }))
      onRefresh?.()
      await loadApprovals()
    } catch (cause) {
      setActionError(
        cause instanceof ApiError && cause.status === 403
          ? 'The server denied this approval request.'
          : cause instanceof Error
            ? cause.message
            : 'Approval request could not be saved.',
      )
    } finally {
      setRequestingId('')
    }
  }

  // Filter list
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((r) => {
      const status = (r.status || 'pending').toLowerCase()
      if (statusFilter !== 'ALL' && status !== statusFilter.toLowerCase()) return false
      if (!searchTerm) return true
      const search = searchTerm.toLowerCase()
      const type = (r.recommendation_type || '').toLowerCase()
      const text = recommendationText(r.proposed_change).toLowerCase()
      const basis = (r.constraint_basis || '').toLowerCase()
      const trigger = (r.trigger_type || '').toLowerCase()
      return type.includes(search) || text.includes(search) || basis.includes(search) || trigger.includes(search)
    })
  }, [recommendations, statusFilter, searchTerm])

  const selectedRec = useMemo(() => {
    if (!selectedId) return null
    return recommendations.find((r) => r.recommendation_id === selectedId) || null
  }, [recommendations, selectedId])

  // KPIs
  const kpis = useMemo(() => {
    const total = recommendations.length
    const pending = recommendations.filter((r) => ['pending', 'proposed', 'open'].includes((r.status || '').toLowerCase())).length
    const implemented = recommendations.filter((r) => ['implemented', 'approved', 'applied'].includes((r.status || '').toLowerCase())).length
    const inApproval = recommendations.filter((r) =>
      r.recommendation_id && approvals.some((a) => a.entity_type === 'recommendation' && a.entity_id === r.recommendation_id)
    ).length
    return { total, pending, implemented, inApproval }
  }, [recommendations, approvals])

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">DECISION SUPPORT · BACKEND ENGINE</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>Recommendations</h2>
          <p className="page-subtitle">
            Algorithmic and rule-derived guidance generated by backend systems to optimize polar logistics and resources.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => onNavigate('approvals')}>
            View Approvals Board
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Recommendation Metrics">
        <div className="kpi-card">
          <span className="kpi-label">TOTAL RECORDS</span>
          <span className="kpi-value">{kpis.total}</span>
          <span className="kpi-hint">From backend engine</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">PENDING REVIEW</span>
          <span className="kpi-value warning">{kpis.pending}</span>
          <span className="kpi-hint">Awaiting operator evaluation</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">FORMAL REVIEW</span>
          <span className="kpi-value info">{kpis.inApproval}</span>
          <span className="kpi-hint">Active approval requests</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">IMPLEMENTED</span>
          <span className="kpi-value success">{kpis.implemented}</span>
          <span className="kpi-hint">Executed changes</span>
        </div>
      </section>

      {actionError && (
        <div className="error-banner" role="alert">
          {actionError}
        </div>
      )}
      {actionNotice && (
        <div className="notice-banner" role="status">
          {actionNotice}
        </div>
      )}
      {approvalsError && (
        <div className="unavailable-state" role="status">
          Approval state is unavailable; request actions are disabled until the approval API can be read. {approvalsError}
          <button type="button" className="btn-link" onClick={() => void loadApprovals()}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <section className="panel">
        {/* Filter Bar */}
        <div className="operational-toolbar">
          <div className="filter-group">
            <label htmlFor="rec-search" className="sr-only">
              Search recommendations
            </label>
            <input
              id="rec-search"
              type="search"
              className="text-input filter-search"
              placeholder="Filter by recommendation, rationale, or trigger..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <div className="btn-group">
              {['ALL', 'pending', 'implemented', 'rejected'].map((s) => (
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

        {dataError ? (
          <div className="unavailable-state" role="status">
            Recommendation data unavailable. {dataError}
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <EmptyState
            message={
              recommendations.length === 0
                ? 'No recommendation records returned by the API.'
                : 'No recommendations matching the active filter criteria.'
            }
          />
        ) : (
          <div className={`table-drawer-layout ${selectedRec ? 'with-drawer' : ''}`}>
            <div className="table-scroll">
              <table className="dense-table" aria-label="Decision Support Recommendations">
                <thead>
                  <tr>
                    <th>Type / Recommendation</th>
                    <th>Reason / Constraints</th>
                    <th>Trigger Source</th>
                    <th>Status</th>
                    <th>Generated</th>
                    <th>Formal Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecommendations.map((rec, index) => {
                    const hasApproval =
                      Boolean(rec.approval_id) ||
                      (rec.recommendation_id
                        ? approvals.some((a) => a.entity_type === 'recommendation' && a.entity_id === rec.recommendation_id)
                        : false)
                    const isSelected = rec.recommendation_id ? selectedId === rec.recommendation_id : false

                    return (
                      <tr
                        key={rec.recommendation_id || index}
                        className={`table-row-selectable ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedId(rec.recommendation_id || null)}
                      >
                        <td>
                          <div className="cell-primary">
                            <span className="badge-tag">{formatStatusLabel(rec.recommendation_type)}</span>
                            <strong className="rec-title">{recommendationText(rec.proposed_change)}</strong>
                          </div>
                          <TechnicalDetails
                            fields={[
                              { label: 'Rec ID', value: rec.recommendation_id },
                              { label: 'Trigger ID', value: rec.trigger_id },
                            ]}
                          />
                        </td>
                        <td>
                          <span className="text-secondary">{rec.constraint_basis || 'Reason not provided by API'}</span>
                        </td>
                        <td>
                          <span className="provenance-tag live">{formatStatusLabel(rec.trigger_type || 'API')}</span>
                        </td>
                        <td>
                          <StatusPill status={rec.status || 'pending'} />
                        </td>
                        <td>
                          <Timestamp value={rec.generated_at} compact />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {approvalsLoading ? (
                            <span className="authority-note">Checking approval status…</span>
                          ) : hasApproval ? (
                            <span className="authority-note active-note">✓ Request under review</span>
                          ) : rec.recommendation_id ? (
                            <div className="approval-actions-inline">
                              <input
                                type="text"
                                className="text-input input-compact"
                                aria-label={`Approval reason for recommendation ${rec.recommendation_id}`}
                                placeholder="Reason for authorization"
                                value={reasonById[rec.recommendation_id] || ''}
                                onChange={(event) =>
                                  setReasonById((old) => ({ ...old, [rec.recommendation_id!]: event.target.value }))
                                }
                              />
                              <button
                                type="button"
                                className="btn-primary-sm"
                                disabled={
                                  Boolean(approvalsError) ||
                                  requestingId === rec.recommendation_id ||
                                  !reasonById[rec.recommendation_id]?.trim()
                                }
                                onClick={() => void requestApproval(rec)}
                              >
                                {requestingId === rec.recommendation_id ? 'Saving…' : 'Request'}
                              </button>
                            </div>
                          ) : (
                            <span className="authority-note">ID unavailable</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Detail Drawer */}
            {selectedRec && (
              <aside className="detail-drawer" aria-label="Recommendation Detail">
                <div className="drawer-header">
                  <div>
                    <span className="eyebrow">RECOMMENDATION DETAIL</span>
                    <h3>{formatStatusLabel(selectedRec.recommendation_type)}</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Close detail panel"
                    onClick={() => setSelectedId(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="drawer-body">
                  <div className="drawer-section">
                    <span className="section-label">PROPOSED CHANGE</span>
                    <p className="detail-value-highlight">{recommendationText(selectedRec.proposed_change)}</p>
                  </div>
                  <div className="drawer-section">
                    <span className="section-label">CONSTRAINT BASIS & RATIONALE</span>
                    <p className="detail-value">{selectedRec.constraint_basis || 'No constraint rationale provided by API'}</p>
                  </div>
                  <div className="drawer-grid">
                    <div>
                      <span className="section-label">STATUS</span>
                      <StatusPill status={selectedRec.status || 'pending'} />
                    </div>
                    <div>
                      <span className="section-label">SOURCE TRIGGER</span>
                      <span className="provenance-tag live">{selectedRec.trigger_type || 'Engine'}</span>
                    </div>
                    <div>
                      <span className="section-label">GENERATED AT</span>
                      <Timestamp value={selectedRec.generated_at} />
                    </div>
                    <div>
                      <span className="section-label">RECOMMENDATION ID</span>
                      <code className="code-badge">{selectedRec.recommendation_id || 'N/A'}</code>
                    </div>
                  </div>

                  <div className="drawer-section">
                    <span className="section-label">ACTION DISPATCH</span>
                    <p className="form-note">
                      Submitting an approval request forwards this recommendation to the Approvals ledger for authorized signature.
                    </p>
                    <button
                      type="button"
                      className="btn-secondary full-width"
                      onClick={() => onNavigate('approvals')}
                    >
                      Open Formal Approvals Board
                    </button>
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

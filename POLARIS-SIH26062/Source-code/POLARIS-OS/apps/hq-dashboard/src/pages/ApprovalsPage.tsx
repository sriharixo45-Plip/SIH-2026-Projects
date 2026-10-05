import { useEffect, useMemo, useState } from 'react'
import type { Approval } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiGet, apiPost, ApiError } from '../services/api'
import { formatDateTime, recordLabel, safeReference, redactDatabaseIds } from '../utils/display'
import { ErrorBanner } from '../components/common/ErrorBanner'

type Props = {
  onRefresh: () => void
  currentUserId?: string
  currentRole?: string | null
}

export function ApprovalsPage({ onRefresh, currentUserId, currentRole }: Props) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [errorDetails, setErrorDetails] = useState<{
    status?: number
    endpoint?: string
    requestId?: string
    body?: string
  }>()
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'approved' | 'rejected'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    setErrorDetails(undefined)
    try {
      const data = await apiGet<Approval[]>('/approvals')
      if (!Array.isArray(data)) throw new Error('The API returned an unexpected approval data format.')
      setApprovals(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approvals unavailable.')
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
    void load()
  }, [])

  const decide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    if (!currentUserId) {
      setError('Authenticated user identity is not available.')
      return
    }
    if (!reasons[approvalId]?.trim()) {
      setError('Enter a decision reason before recording a decision.')
      return
    }
    setError('')
    setSubmittingId(approvalId)
    try {
      await apiPost(`/approvals/${approvalId}/decide`, {
        decision,
        reason: reasons[approvalId].trim(),
      })
      setReasons((old) => ({ ...old, [approvalId]: '' }))
      setNotice(`Decision recorded by the backend: ${decision.toUpperCase()}.`)
      onRefresh()
      await load()
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 403
          ? 'The server rejected this decision as unauthorized for your role.'
          : e instanceof Error
            ? e.message
            : 'Unable to record decision.',
      )
      if (e instanceof ApiError) {
        setErrorDetails({
          status: e.status,
          endpoint: e.endpoint,
          requestId: e.requestId,
          body: e.technicalDetails,
        })
      }
    } finally {
      setSubmittingId(null)
    }
  }

  // Filtered
  const filteredApprovals = useMemo(() => {
    return approvals.filter((row) => {
      const state = (row.decision || row.status || 'pending').toLowerCase()
      if (statusFilter !== 'ALL' && state !== statusFilter) return false
      if (!searchTerm) return true
      const s = searchTerm.toLowerCase()
      const entityType = (row.entity_type || '').toLowerCase()
      const entityId = (row.entity_id || '').toLowerCase()
      const requester = (row.requested_by || '').toLowerCase()
      const decider = (row.decided_by || '').toLowerCase()
      const reason = (row.reason || row.comments || '').toLowerCase()
      return (
        entityType.includes(s) ||
        entityId.includes(s) ||
        requester.includes(s) ||
        decider.includes(s) ||
        reason.includes(s)
      )
    })
  }, [approvals, statusFilter, searchTerm])

  const selectedApproval = useMemo(() => {
    if (!selectedId) return null
    return approvals.find((a) => a.approval_id === selectedId) || null
  }, [approvals, selectedId])

  // KPIs
  const kpis = useMemo(() => {
    const total = approvals.length
    const pending = approvals.filter((a) => (a.decision || a.status || 'pending').toLowerCase() === 'pending').length
    const approved = approvals.filter((a) => (a.decision || a.status || '').toLowerCase() === 'approved').length
    const rejected = approvals.filter((a) => (a.decision || a.status || '').toLowerCase() === 'rejected').length
    return { total, pending, approved, rejected }
  }, [approvals])

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="page-header-bar">
        <div>
          <div className="page-title-row">
            <p className="eyebrow">OPERATIONAL GOVERNANCE & COMPLIANCE</p>
            <span className="provenance-tag live">API / LIVE</span>
          </div>
          <h2>Approvals & Authorization</h2>
          <p className="page-subtitle">
            Formal decision records awaiting executive authorization or recording signed outcomes.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            Refresh Ledger
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="kpi-strip" aria-label="Approvals KPIs">
        <div className="kpi-card">
          <span className="kpi-label">PENDING DECISION</span>
          <span className="kpi-value warning">{kpis.pending}</span>
          <span className="kpi-hint">Requiring sign-off</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">APPROVED</span>
          <span className="kpi-value success">{kpis.approved}</span>
          <span className="kpi-hint">Authorized actions</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">REJECTED</span>
          <span className="kpi-value alert">{kpis.rejected}</span>
          <span className="kpi-hint">Declined actions</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">TOTAL REQUESTS</span>
          <span className="kpi-value">{kpis.total}</span>
          <span className="kpi-hint">Ledger entries</span>
        </div>
      </section>

      {notice && (
        <div className="notice-banner" role="status">
          {notice}
        </div>
      )}
      {error && <ErrorBanner message={error} details={errorDetails} onRetry={() => void load()} />}

      {/* Main Panel */}
      <section className="panel">
        {/* Toolbar */}
        <div className="operational-toolbar">
          <div className="filter-group">
            <label htmlFor="approvals-search" className="sr-only">
              Search approvals
            </label>
            <input
              id="approvals-search"
              type="search"
              className="text-input filter-search"
              placeholder="Search by entity, requester, or justification..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <span className="filter-label">Filter:</span>
            <div className="btn-group">
              {(['ALL', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`btn-filter ${statusFilter === filter ? 'active' : ''}`}
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="data-note" role="status">
            Loading formal approval records...
          </p>
        ) : error ? (
          <div className="unavailable-state" role="status">
            Approval records unavailable. {error}
          </div>
        ) : filteredApprovals.length === 0 ? (
          <EmptyState
            message={
              approvals.length === 0
                ? 'No approval records returned by the API.'
                : 'No approvals match the active filter criteria.'
            }
          />
        ) : (
          <div className={`table-drawer-layout ${selectedApproval ? 'with-drawer' : ''}`}>
            <div className="table-scroll">
              <table className="dense-table" aria-label="Approvals Ledger">
                <thead>
                  <tr>
                    <th>Action / Entity</th>
                    <th>Requester</th>
                    <th>Authority Required</th>
                    <th>Status</th>
                    <th>Decision / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.map((row) => {
                    const state = (row.decision || row.status || 'pending').toLowerCase()
                    const isPending = state === 'pending'
                    const isSelected = selectedId === row.approval_id

                    return (
                      <tr
                        key={row.approval_id}
                        className={`table-row-selectable ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedId(row.approval_id)}
                      >
                        <td>
                          <div className="cell-primary">
                            <span className="badge-tag">{formatStatusLabel(row.entity_type)}</span>
                            <span className="record-code">{recordLabel(null, row.entity_id, 'Entity not provided')}</span>
                          </div>
                          <span className="table-subtext">Approval ID: {row.approval_id}</span>
                        </td>
                        <td>
                          <strong>{safeReference(row.requested_by)}</strong>
                        </td>
                        <td>
                          <span className="text-secondary">Authoritative role required</span>
                        </td>
                        <td>
                          <StatusPill status={state} />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {isPending ? (
                            <div className="approval-actions-box">
                              <label className="sr-only" htmlFor={`reason-${row.approval_id}`}>
                                Decision reason for {recordLabel(null, row.approval_id)}
                              </label>
                              <textarea
                                id={`reason-${row.approval_id}`}
                                className="textarea-input input-compact"
                                placeholder="Decision reason (mandatory for audit trail)"
                                value={reasons[row.approval_id] || ''}
                                onChange={(event) =>
                                  setReasons((old) => ({ ...old, [row.approval_id]: event.target.value }))
                                }
                              />
                              <p className="authority-note">
                                Current role: <strong>{recordLabel(currentRole, undefined, 'Operator')}</strong> · Server authorization governs final resolution.
                              </p>
                              <div className="btn-group">
                                <button
                                  type="button"
                                  className="btn-primary-sm"
                                  disabled={
                                    loading ||
                                    submittingId === row.approval_id ||
                                    !reasons[row.approval_id]?.trim()
                                  }
                                  onClick={() => void decide(row.approval_id, 'approved')}
                                >
                                  {submittingId === row.approval_id ? 'Recording…' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger-sm"
                                  disabled={
                                    loading ||
                                    submittingId === row.approval_id ||
                                    !reasons[row.approval_id]?.trim()
                                  }
                                  onClick={() => void decide(row.approval_id, 'rejected')}
                                >
                                  {submittingId === row.approval_id ? 'Recording…' : 'Reject'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="decision-summary">
                              <p className="decision-text">
                                {redactDatabaseIds(row.reason || row.comments || 'No decision reason recorded')}
                              </p>
                              <div className="decision-meta">
                                <span>Decided by: {safeReference(row.decided_by, 'Decision maker not provided')}</span>
                                {row.decided_at && !Number.isNaN(Date.parse(row.decided_at)) && (
                                  <span> · {formatDateTime(row.decided_at, true)}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Detail Drawer */}
            {selectedApproval && (
              <aside className="detail-drawer" aria-label="Approval Details">
                <div className="drawer-header">
                  <div>
                    <span className="eyebrow">AUTHORIZATION AUDIT</span>
                    <h3>{formatStatusLabel(selectedApproval.entity_type)}</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Close detail drawer"
                    onClick={() => setSelectedId(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="drawer-body">
                  <div className="drawer-section">
                    <span className="section-label">APPROVAL STATUS</span>
                    <StatusPill status={(selectedApproval.decision || selectedApproval.status || 'pending').toLowerCase()} />
                  </div>
                  <div className="drawer-grid">
                    <div>
                      <span className="section-label">APPROVAL ID</span>
                      <code className="code-badge">{selectedApproval.approval_id}</code>
                    </div>
                    <div>
                      <span className="section-label">ENTITY TYPE</span>
                      <span className="detail-value">{formatStatusLabel(selectedApproval.entity_type)}</span>
                    </div>
                    <div>
                      <span className="section-label">ENTITY ID</span>
                      <code className="code-badge">{selectedApproval.entity_id || 'N/A'}</code>
                    </div>
                    <div>
                      <span className="section-label">REQUESTED BY</span>
                      <span className="detail-value">{safeReference(selectedApproval.requested_by)}</span>
                    </div>
                  </div>

                  <div className="drawer-section">
                    <span className="section-label">DECISION / RATIONALE</span>
                    <p className="detail-value-highlight">
                      {selectedApproval.reason || selectedApproval.comments || 'No recorded decision rationale.'}
                    </p>
                  </div>

                  {selectedApproval.decided_by && (
                    <div className="drawer-section">
                      <span className="section-label">DECIDED BY & TIMESTAMP</span>
                      <p className="detail-value">
                        {safeReference(selectedApproval.decided_by)}
                        {selectedApproval.decided_at && (
                          <span> at {formatDateTime(selectedApproval.decided_at, true)}</span>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="drawer-section">
                    <span className="section-label">SECURITY & PROVENANCE</span>
                    <p className="form-note">
                      All approvals are cryptographically signed and stored in the canonical backend audit ledger.
                    </p>
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

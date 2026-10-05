import { useMemo, useState } from 'react'
import type { Expedition } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { recordLabel } from '../utils/display'

type Props = { expeditions: Expedition[]; dataError?: string }

function formatDate(value?: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not provided'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getRowClass(status?: string | null): string {
  const s = (status ?? '').toLowerCase()
  if (['cancelled', 'canceled', 'failed'].includes(s)) return 'is-warning'
  if (['critical', 'emergency'].includes(s)) return 'is-critical'
  return ''
}

export function ExpeditionsPage({ expeditions, dataError }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const kpi = useMemo(() => {
    const active = expeditions.filter(e => ['active', 'in_progress', 'in progress', 'ongoing'].includes((e.status ?? '').toLowerCase())).length
    const planned = expeditions.filter(e => ['planned', 'pending', 'scheduled'].includes((e.status ?? '').toLowerCase())).length
    const completed = expeditions.filter(e => ['completed', 'closed', 'finished'].includes((e.status ?? '').toLowerCase())).length
    const delayed = expeditions.filter(e => ['delayed', 'overdue'].includes((e.status ?? '').toLowerCase())).length
    return { active, planned, completed, delayed }
  }, [expeditions])

  const selected = expeditions.find(e => e.expedition_id === selectedId) ?? null

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="op-page-header">
        <div className="op-page-header-left">
          <p className="op-page-eyebrow">
            MISSION REGISTER
            <span className="prov-chip api">API</span>
          </p>
          <h1 className="op-page-title">Expeditions</h1>
          <p className="op-page-desc">Mission planning, status and operational period for all registered expeditions.</p>
        </div>
        <div className="op-page-header-right">
          {dataError && <span className="prov-chip unavail">DATA UNAVAILABLE</span>}
        </div>
      </div>

      {/* KPI STRIP */}
      {!dataError && (
        <div className="op-kpi-strip">
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Total</span>
            <span className="op-kpi-value">{expeditions.length}</span>
            <span className="op-kpi-sub">expedition records</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Active</span>
            <span className={`op-kpi-value${kpi.active > 0 ? ' kpi-success' : ''}`}>{kpi.active}</span>
            <span className="op-kpi-sub">in progress</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Planned</span>
            <span className="op-kpi-value">{kpi.planned}</span>
            <span className="op-kpi-sub">scheduled</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Completed</span>
            <span className="op-kpi-value kpi-muted">{kpi.completed}</span>
            <span className="op-kpi-sub">closed out</span>
          </div>
          <div className="op-kpi-cell">
            <span className="op-kpi-label">Delayed</span>
            <span className={`op-kpi-value${kpi.delayed > 0 ? ' kpi-warning' : ' kpi-muted'}`}>{kpi.delayed}</span>
            <span className="op-kpi-sub">overdue</span>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {dataError ? (
        <section className="panel">
          <div className="panel-body">
            <div className="op-empty-state">
              <div className="op-empty-icon">⚠</div>
              <p className="op-empty-title">EXPEDITION DATA UNAVAILABLE</p>
              <p className="op-empty-desc">{dataError}</p>
              <span className="op-empty-source">SOURCE: API · REQUEST FAILED</span>
            </div>
          </div>
        </section>
      ) : expeditions.length === 0 ? (
        <section className="panel">
          <div className="panel-body">
            <div className="op-empty-state">
              <div className="op-empty-icon">🧭</div>
              <p className="op-empty-title">NO EXPEDITION RECORDS</p>
              <p className="op-empty-desc">No expedition records are currently available from the API. Records will appear here when expeditions are registered in the backend.</p>
              <span className="op-empty-source">SOURCE: API</span>
            </div>
          </div>
        </section>
      ) : (
        <div className="exp-layout">
          {/* EXPEDITION TABLE */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">MISSION LIST</p>
                <h2>Expeditions ({expeditions.length})</h2>
              </div>
            </div>
            <div className="op-table-wrap">
              <table className="op-table">
                <thead>
                  <tr>
                    <th>Mission identifier</th>
                    <th>Name</th>
                    <th>Season</th>
                    <th>Status</th>
                    <th>Planned start</th>
                    <th>Planned end</th>
                  </tr>
                </thead>
                <tbody>
                  {expeditions.map((exp) => (
                    <tr
                      key={exp.expedition_id}
                      className={[getRowClass(exp.status), selectedId === exp.expedition_id ? 'is-selected' : ''].filter(Boolean).join(' ')}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedId(selectedId === exp.expedition_id ? null : exp.expedition_id)}
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(selectedId === exp.expedition_id ? null : exp.expedition_id) } }}
                      aria-selected={selectedId === exp.expedition_id}
                    >
                      <td>
                        <span className="op-cell-mono exp-mission-id">{recordLabel(exp.code, exp.expedition_id)}</span>
                      </td>
                      <td>
                        <span className="op-cell-primary">{recordLabel(exp.name, exp.expedition_id, 'Name not provided')}</span>
                      </td>
                      <td>
                        {exp.season ? (
                          <span className="exp-season-badge">{exp.season}</span>
                        ) : (
                          <span className="op-cell-secondary">Not provided</span>
                        )}
                      </td>
                      <td><StatusPill status={exp.status} /></td>
                      <td><span className="op-cell-mono exp-date-range">{formatDate(exp.planned_start)}</span></td>
                      <td><span className="op-cell-mono exp-date-range">{formatDate(exp.planned_end)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* DETAIL PANEL */}
          {selected ? (
            <section className="op-detail-panel" aria-label="Expedition detail">
              <div className="op-detail-header">
                <div>
                  <p className="eyebrow">EXPEDITION DETAIL</p>
                  <h2 style={{ fontSize: '15px', marginTop: '2px' }}>{recordLabel(selected.name, selected.expedition_id, 'Name not provided')}</h2>
                </div>
                <StatusPill status={selected.status} />
              </div>
              <div className="op-detail-body">
                <dl className="op-detail-grid">
                  <div className="op-detail-field">
                    <dt>Mission code</dt>
                    <dd className="mono">{recordLabel(selected.code, selected.expedition_id)}</dd>
                  </div>
                  <div className="op-detail-field">
                    <dt>Status</dt>
                    <dd><StatusPill status={selected.status} /></dd>
                  </div>
                  <div className="op-detail-field">
                    <dt>Season</dt>
                    <dd>{selected.season || 'Not provided'}</dd>
                  </div>
                  <div className="op-detail-field">
                    <dt>Data source</dt>
                    <dd><span className="prov-chip api">API</span></dd>
                  </div>
                  <div className="op-detail-field">
                    <dt>Planned start</dt>
                    <dd className="mono">{formatDate(selected.planned_start)}</dd>
                  </div>
                  <div className="op-detail-field">
                    <dt>Planned end</dt>
                    <dd className="mono">{formatDate(selected.planned_end)}</dd>
                  </div>
                  <div className="op-detail-field" style={{ gridColumn: '1 / -1' }}>
                    <dt>Expedition ID</dt>
                    <dd className="mono" style={{ fontSize: '10px', wordBreak: 'break-all', opacity: 0.7 }}>{selected.expedition_id}</dd>
                  </div>
                </dl>
                <p className="data-note" style={{ marginTop: '14px' }}>Personnel, cargo and transport data linked to this expedition are available in the respective operational pages.</p>
              </div>
            </section>
          ) : (
            <section className="op-detail-panel" aria-label="Expedition detail placeholder">
              <div className="op-detail-header">
                <div>
                  <p className="eyebrow">EXPEDITION DETAIL</p>
                  <h2 style={{ fontSize: '14px', marginTop: '2px', color: 'var(--polar-muted)' }}>Select a record</h2>
                </div>
              </div>
              <div className="op-detail-body">
                <p className="data-note">Click any expedition row to view full mission details.</p>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

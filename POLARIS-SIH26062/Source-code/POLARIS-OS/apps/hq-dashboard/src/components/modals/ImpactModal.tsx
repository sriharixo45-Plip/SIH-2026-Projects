import { useEffect, useRef } from 'react'
import type { TransportImpact } from '../../types'
import { formatStatusLabel } from '../common/StatusPill'
import type { Station } from '../../types'
import { isDatabaseId, recordLabel, redactDatabaseIds, stationLabelByReference } from '../../utils/display'
type Props = { impact: TransportImpact | null; stations: Station[]; onClose: () => void }
function valueLabel(key: string, value: unknown) {
  const text = String(value)
  if (!isDatabaseId(text)) return redactDatabaseIds(text)
  if (key.includes('station')) return 'Station unavailable'
  return recordLabel(null, text)
}
function ImpactList({ title, items, empty }: { title: string; items?: Array<Record<string, unknown>>; empty: string }) {
  return <section className="impact-section"><h3>{title}</h3>{items?.length ? <ul>{items.map((item, index) => <li key={String(item.id ?? item.cargo_id ?? item.personnel_id ?? item.stock_id ?? index)}>{Object.entries(item).filter(([, v]) => v != null && typeof v !== 'object').slice(0, 5).map(([key, v]) => <span key={key}><strong>{formatStatusLabel(key)}:</strong> {valueLabel(key, v)}</span>)}</li>)}</ul> : <p className="data-note">{empty}</p>}</section>
}
export function ImpactModal({ impact, stations, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!impact) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')
      if (!focusable?.length) return
      const first = focusable[0]; const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); previous?.focus() }
  }, [impact, onClose])
  if (!impact) return null
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="impact-modal" role="dialog" aria-modal="true" aria-labelledby="impact-title" tabIndex={-1}>
      <div className="modal-header"><div><p className="eyebrow">BACKEND IMPACT ANALYSIS</p><h2 id="impact-title">{recordLabel(impact.transport_leg?.code, impact.transport_leg?.leg_id, 'Transport leg unavailable')}</h2></div><button ref={closeRef} type="button" className="btn-close" aria-label="Close impact analysis" onClick={onClose}>Close</button></div>
      <dl className="impact-summary"><div><dt>Disruption</dt><dd>{formatStatusLabel(impact.disruption_status)}</dd></div><div><dt>Severity</dt><dd>{formatStatusLabel(impact.overall_severity)}</dd></div><div><dt>Route</dt><dd>{stationLabelByReference(impact.transport_leg?.origin, stations, 'origin')} to {stationLabelByReference(impact.transport_leg?.destination, stations, 'destination')}</dd></div></dl>
      <section className="impact-section"><h3>Identified risks</h3>{impact.identified_risks?.length ? <ul>{impact.identified_risks.map((risk, index) => <li key={`${risk}-${index}`}>{redactDatabaseIds(risk)}</li>)}</ul> : <p className="data-note">No risks identified by the API.</p>}</section>
      <ImpactList title="Affected cargo" items={impact.affected_cargo} empty="No affected cargo identified." />
      <ImpactList title="Affected personnel" items={impact.affected_personnel_assignments} empty="No affected personnel identified." />
      <ImpactList title="Affected inventory" items={impact.affected_inventory} empty="No affected inventory identified." />
      <section className="impact-section"><h3>Related incident</h3><p className="data-note">{impact.incident ? `${formatStatusLabel(impact.incident.type)} - ${formatStatusLabel(impact.incident.status)} - ${recordLabel(null, impact.incident.incident_id)}` : impact.incident_creation_skipped ? 'No incident was created by the backend.' : 'No related incident provided.'}</p></section>
      <section className="impact-section"><h3>Recommendation</h3><p className="data-note">{impact.recommendation ? `${formatStatusLabel(impact.recommendation.recommendation_type)} · ${formatStatusLabel(impact.recommendation.status)} · ${typeof impact.recommendation.proposed_change === 'string' ? redactDatabaseIds(impact.recommendation.proposed_change) : 'Details provided by backend.'}` : 'No recommendation provided.'}</p></section>
      <p className="data-note">Approval state is not included in the impact response.</p>
    </section>
  </div>
}

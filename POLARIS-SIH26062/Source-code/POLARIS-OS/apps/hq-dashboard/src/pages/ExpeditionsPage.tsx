import type { Expedition } from '../types'
import { StatusPill } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { recordLabel } from '../utils/display'

type Props = { expeditions: Expedition[]; dataError?: string }
export function ExpeditionsPage({ expeditions, dataError }: Props) {
  return <div className="page-container"><section className="panel"><div className="panel-header"><div><p className="eyebrow">MISSION REGISTER</p><h2>{dataError ? 'Expedition data unavailable' : `Expeditions (${expeditions.length})`}</h2></div></div>
    {dataError ? <div className="unavailable-state" role="status">Expedition data unavailable. {dataError}</div> : !expeditions.length ? <EmptyState message="No expedition records returned by the API." /> : <div className="table-scroll"><table><thead><tr><th>Code</th><th>Expedition</th><th>Season</th><th>Status</th><th>Planned start</th><th>Planned end</th></tr></thead><tbody>{expeditions.map((expedition) => <tr key={expedition.expedition_id}><td>{recordLabel(expedition.code, expedition.expedition_id)}</td><td>{recordLabel(expedition.name, expedition.expedition_id, 'Name not provided')}</td><td>{expedition.season || 'Not provided'}</td><td><StatusPill status={expedition.status} /></td><td>{expedition.planned_start && !Number.isNaN(Date.parse(expedition.planned_start)) ? new Date(expedition.planned_start).toLocaleDateString() : 'Not provided'}</td><td>{expedition.planned_end && !Number.isNaN(Date.parse(expedition.planned_end)) ? new Date(expedition.planned_end).toLocaleDateString() : 'Not provided'}</td></tr>)}</tbody></table></div>}
  </section></div>
}

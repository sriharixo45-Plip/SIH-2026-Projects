import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Incident, Personnel, Station, TransportLeg } from '../types'
import { StatusPill, formatStatusLabel } from '../components/common/StatusPill'
import { EmptyState } from '../components/common/EmptyState'
import { apiPost, ApiError } from '../services/api'
import { isSupportedIndianStation, recordLabel, stationLabelByReference, transportLabelById } from '../utils/display'
import { Timestamp } from '../components/common/Timestamp'
import { TechnicalDetails } from '../components/common/TechnicalDetails'
import { demoOperationsStore } from '../services/operations-demo'

type IncidentsPageProps = {
  incidents: Incident[]
  dataError?: string
  stations: Station[]
  transportLegs: TransportLeg[]
  personnel: Personnel[]
  onRefresh: () => void
  currentUserId?: string
}

export function IncidentsPage({ incidents, dataError, stations, transportLegs, personnel, onRefresh, currentUserId }: IncidentsPageProps) {
  useEffect(()=>{const id=sessionStorage.getItem('polaris_api_incident_focus');if(id){document.getElementById(`api-incident-${id}`)?.scrollIntoView({block:'center',behavior:'smooth'});sessionStorage.removeItem('polaris_api_incident_focus')}},[])
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const [type, setType] = useState('transport_disruption')
  const [severity, setSeverity] = useState<'low' | 'moderate' | 'high' | 'critical'>('high')
  const [stationId, setStationId] = useState('')
  const [legId, setLegId] = useState('')
  const [description, setDescription] = useState('')

  const handleCreateIncident = async (e: FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      setFormError('Description is required.')
      return
    }

    if (!currentUserId) {
      setFormError('User authentication context missing.')
      return
    }

    setIsSubmitting(true)
    setFormError(null)
    setFormSuccess(null)

    try {
      await apiPost('/incidents', {
        type,
        severity,
        station_id: stationId || undefined,
        leg_id: legId || undefined,
        description: description.trim(),
        declared_by: currentUserId,
        status: 'declared',
      })

      demoOperationsStore.recordIncident(`${severity.toUpperCase()} ${type.replace(/_/g,' ')} incident declared${stationId?` at ${stationLabelByReference(stationId,stations)}`:''}.`, currentUserId)
      setFormSuccess('Incident logged and declared successfully.')
      setDescription('')
      setShowForm(false)
      onRefresh()
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 403 ? 'The server rejected this incident declaration as unauthorized.' : err instanceof Error ? err.message : 'Unable to log incident'
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <div className="page-container">
      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">RESPONSE & CRISIS MANAGEMENT</span>
            <h3>{dataError ? 'Incident data unavailable' : `Operational Incident Log (${incidents.length})`}</h3>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setShowForm(!showForm)
              setFormError(null)
              setFormSuccess(null)
            }}
          >
            {showForm ? 'CANCEL' : '+ REPORT INCIDENT'}
          </button>
        </div>

        {formSuccess ? <div className="notice-banner">{formSuccess}</div> : null}
        {formError ? <div className="error-banner">{formError}</div> : null}
        {stations.some((station) => !isSupportedIndianStation(station)) && <div className="unavailable-state">Unsupported station record returned by API. Only Maitri and Bharati can be selected for a new incident.</div>}

        {showForm ? (
          <div className="panel-body form-section">
            <h4 className="form-heading">DECLARE NEW OPERATIONAL INCIDENT</h4>
            <form onSubmit={handleCreateIncident} className="grid-form">
              <div className="form-group">
                <label htmlFor="incident-type">Incident type</label>
                <select id="incident-type" className="select-input" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="transport_disruption">TRANSPORT DISRUPTION</option>
                  <option value="cargo_issue">CARGO ISSUE</option>
                  <option value="weather_delay">WEATHER DELAY</option>
                  <option value="personnel_issue">PERSONNEL ISSUE</option>
                  <option value="equipment_failure">EQUIPMENT FAILURE</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="incident-severity">Severity</label>
                <select id="incident-severity" className="select-input" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
                  <option value="low">LOW</option>
                  <option value="moderate">MODERATE</option>
                  <option value="high">HIGH</option>
                  <option value="critical">CRITICAL</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="incident-station">Station (optional)</label>
                <select id="incident-station" className="select-input" value={stationId} onChange={(e) => setStationId(e.target.value)}>
                  <option value="">NONE / REGIONAL</option>
                  {stations.filter(isSupportedIndianStation).map((s) => (
                    <option key={s.station_id} value={s.station_id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="incident-leg">Transport leg (optional)</label>
                <select id="incident-leg" className="select-input" value={legId} onChange={(e) => setLegId(e.target.value)}>
                  <option value="">NONE</option>
                  {transportLegs.map((l) => (
                    <option key={l.leg_id} value={l.leg_id}>
                      {recordLabel(l.code, l.leg_id)} ({stationLabelByReference(l.origin, stations, 'origin')} â†’ {stationLabelByReference(l.destination, stations, 'destination')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label htmlFor="incident-description">Description and impact details</label>
                <textarea
                  id="incident-description"
                  className="textarea-input"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the operational disruption, affected assets, or required response..."
                  required
                />
              </div>

              <div className="form-actions full-width">
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'SUBMITTINGâ€¦' : 'SUBMIT INCIDENT DECLARATION'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="panel-body">
          {dataError ? <div className="unavailable-state" role="status">Incident data unavailable. {dataError}</div> : incidents.length === 0 ? (
            <EmptyState message="No incidents declared in the current expedition operational log." />
          ) : (
            <div className="table-scroll"><table><thead><tr><th>Incident reference</th><th>Type</th><th>Severity</th><th>Description</th><th>Station</th><th>Transport</th><th>Status</th><th>Declared by</th><th>Created</th></tr></thead><tbody>
              {incidents.map((inc) => { const declarer = personnel.find((person) => person.user_id === inc.declared_by || person.person_id === inc.declared_by); const declaredBy = recordLabel(declarer?.name || [declarer?.first_name, declarer?.last_name].filter(Boolean).join(' '), declarer?.employee_code || inc.declared_by, 'Not provided'); const station = stations.find((item) => item.station_id === inc.station_id); const stationMapped = station ? isSupportedIndianStation(station) : true; const stationDisplay = station ? (stationMapped ? station.name : 'Station mapping unavailable') : inc.station_id ? 'Station mapping unavailable' : 'Not provided'; return <tr id={`api-incident-${inc.incident_id}`} key={inc.incident_id}><td>{recordLabel(null, inc.incident_id)}<TechnicalDetails fields={[{ label: 'Incident ID', value: inc.incident_id }, { label: 'Declared by ID', value: inc.declared_by }, { label: 'Station mapping', value: station ? stationMapped ? undefined : 'Station mapping unavailable' : inc.station_id ? 'Station mapping unavailable' : undefined }, { label: 'Station ID', value: inc.station_id }, { label: 'Transport reference', value: inc.leg_id }]} /></td><td>{formatStatusLabel(inc.type)}</td><td><StatusPill status={inc.severity} /></td><td>{inc.description || 'Not provided'}</td><td>{stationDisplay}</td><td>{transportLabelById(inc.leg_id, transportLegs)}</td><td><StatusPill status={inc.status} /></td><td>{declaredBy}</td><td><Timestamp value={inc.declared_at} compact /></td></tr>})}
            </tbody></table></div>
          )}
        </div>
      </section>
    </div>
  )
}


import { useMemo, useState, useSyncExternalStore } from 'react'
import { Search, RefreshCw, Bell, Sun, Moon, LogOut } from 'lucide-react'
import { PolarClock } from '../common/PolarClock'
import { StatusPill } from '../common/StatusPill'
import { recordLabel } from '../../utils/display'
import { demoOperationsStore } from '../../services/operations-demo'
import { demoBases } from '../../mock-data/operations'
import type { CargoItem, Expedition, Incident, Personnel, Station, TransportLeg } from '../../types'

type UserSummary = {
  full_name?: string | null
  email?: string | null
  employee_code?: string | null
  role?: string | null
  scope?: string | null
}

type TopbarProps = {
  title: string
  subtitle: string
  connection: 'checking' | 'connected' | 'error'
  lastRefresh: string | null
  onRefresh: () => void
  isRefreshing: boolean
  user: UserSummary
  onLogout: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onNavigate: (route: string) => void
  apiData: {
    stations: Station[]
    expeditions: Expedition[]
    cargoItems: CargoItem[]
    personnel: Personnel[]
    incidents: Incident[]
    transportLegs: TransportLeg[]
  }
}

export function Topbar({
  title,
  subtitle,
  connection,
  lastRefresh,
  onRefresh,
  isRefreshing,
  user,
  onLogout,
  theme,
  onToggleTheme,
  onNavigate,
  apiData,
}: TopbarProps) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const state = useSyncExternalStore(
    demoOperationsStore.subscribe,
    demoOperationsStore.getState,
    demoOperationsStore.getState
  )

  // Determine active mission and period/season
  const activeExpedition = useMemo(() => {
    const active = apiData.expeditions.find(
      (e) => (e.status || '').toLowerCase() === 'active' || (e.status || '').toLowerCase() === 'operational'
    )
    return active || apiData.expeditions[0] || null
  }, [apiData.expeditions])

  // Compute operational KPI metrics for the compact strip
  const activeTransportCount = useMemo(
    () =>
      apiData.transportLegs.filter(
        (leg) =>
          (leg.status || '').toLowerCase() === 'in_transit' ||
          (leg.status || '').toLowerCase() === 'active' ||
          (leg.status || '').toLowerCase() === 'planned'
      ).length,
    [apiData.transportLegs]
  )

  const openIncidentsCount = useMemo(
    () =>
      apiData.incidents.filter(
        (inc) => !['resolved', 'closed'].includes((inc.status || '').toLowerCase())
      ).length,
    [apiData.incidents]
  )

  const unreadNotificationsCount = state.notifications.filter((item) => !item.read).length

  // Global search compilation across API and Demo datasets
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const rows = [
      ...state.assets.map((x) => ({
        type: x.kind === 'ship' ? 'DEMO SHIP' : 'DEMO FLIGHT',
        label: `${x.id} · ${x.name}`,
        match: `${x.id} ${x.name} ${x.registration} ${x.imo ?? ''} ${x.mmsi ?? ''}`,
        go: () => {
          sessionStorage.setItem('polaris_map_focus', x.id)
          onNavigate('tracking')
        },
      })),
      ...state.operations.map((x) => ({
        type: 'DEMO OPERATION',
        label: `${x.id} · ${x.name}`,
        match: `${x.id} ${x.name} ${x.destination}`,
        go: () => {
          sessionStorage.setItem('polaris_operation_focus', x.id)
          onNavigate('demo-operations')
        },
      })),
      ...state.cargo.map((x) => ({
        type: 'DEMO CARGO',
        label: `${x.id} · ${x.description}`,
        match: `${x.id} ${x.description} ${x.category} ${x.assetId} ${x.operationId}`,
        go: () => {
          sessionStorage.setItem('polaris_cargo_focus', x.assetId)
          onNavigate('demo-cargo')
        },
      })),
      ...state.employees.map((x) => ({
        type: 'DEMO PERSONNEL',
        label: `${x.id} · ${x.name}`,
        match: `${x.id} ${x.name} ${x.role} ${x.base} ${x.operationId ?? ''}`,
        go: () => {
          sessionStorage.setItem('polaris_employee_focus', x.id)
          onNavigate('personnel')
        },
      })),
      ...demoBases.map((x) => ({
        type: 'DEMO BASE',
        label: `${x.id} · ${x.name}`,
        match: `${x.id} ${x.name} ${x.region}`,
        go: () => onNavigate('bases'),
      })),
      ...state.incidents.map((x) => ({
        type: 'DEMO INCIDENT',
        label: `${x.id} · ${x.type}`,
        match: `${x.id} ${x.type} ${x.description} ${x.base}`,
        go: () => {
          sessionStorage.setItem('polaris_incident_focus', x.id)
          const a = state.assets.find((ast) => ast.operationId === x.operationId)
          if (a) sessionStorage.setItem('polaris_map_focus', a.id)
          onNavigate('incidents')
        },
      })),
      ...apiData.expeditions.map((x) => ({
        type: 'EXPEDITION',
        label: `${x.code || x.expedition_id} · ${x.name || 'Expedition'}`,
        match: `${x.code ?? ''} ${x.expedition_id} ${x.name ?? ''} ${x.season ?? ''}`,
        go: () => onNavigate('expeditions'),
      })),
      ...apiData.transportLegs.map((x) => ({
        type: 'TRANSPORT',
        label: `${x.code || x.leg_id} · ${x.origin || 'Origin'} to ${x.destination || 'Destination'}`,
        match: `${x.code ?? ''} ${x.leg_id} ${x.origin ?? ''} ${x.destination ?? ''} ${x.status ?? ''}`,
        go: () => onNavigate('transport'),
      })),
      ...apiData.cargoItems.map((x) => ({
        type: 'API CARGO',
        label: `${x.tracking_code || x.cargo_id} · ${x.description || x.category || 'Cargo record'}`,
        match: `${x.tracking_code ?? ''} ${x.cargo_id} ${x.description ?? ''} ${x.category ?? ''}`,
        go: () => onNavigate('cargo'),
      })),
      ...apiData.personnel.map((x) => ({
        type: 'API PERSONNEL',
        label: `${x.employee_code || x.person_id} · ${x.name || [x.first_name, x.last_name].filter(Boolean).join(' ')}`,
        match: `${x.employee_code ?? ''} ${x.person_id} ${x.name ?? ''} ${x.first_name ?? ''} ${x.last_name ?? ''} ${x.role ?? ''}`,
        go: () => {
          sessionStorage.setItem('polaris_api_person_focus', x.person_id)
          onNavigate('personnel')
        },
      })),
      ...apiData.stations.map((x) => ({
        type: 'API BASE',
        label: `${x.code || x.station_id} · ${x.name}`,
        match: `${x.code} ${x.station_id} ${x.name}`,
        go: () => {
          const base = demoBases.find(
            (b) => b.id === x.code?.toUpperCase() || b.name.toLowerCase() === x.name.toLowerCase()
          )
          if (base && base.point.lat < -32) sessionStorage.setItem('polaris_base_focus', base.id)
          else sessionStorage.setItem('polaris_map_search', x.name)
          onNavigate('tracking')
        },
      })),
      ...apiData.incidents.map((x) => ({
        type: 'API INCIDENT',
        label: `${x.incident_id} · ${x.type || 'Incident'}`,
        match: `${x.incident_id} ${x.type ?? ''} ${x.description ?? ''} ${x.status ?? ''}`,
        go: () => {
          sessionStorage.setItem('polaris_api_incident_focus', x.incident_id)
          onNavigate('incidents')
        },
      })),
    ]
    return rows.filter((x) => x.match.toLowerCase().includes(q)).slice(0, 8)
  }, [query, state, onNavigate, apiData])

  const choose = (item: (typeof results)[number]) => {
    item.go()
    setQuery('')
    setSearchOpen(false)
  }

  const connectionLabel = connection === 'connected' ? 'Connected' : connection === 'error' ? 'Offline' : 'Checking'
  const lastRefreshLabel = lastRefresh
    ? `${new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(lastRefresh))} IST`
    : 'Pending'

  return (
    <header className="polar-opbar topbar" aria-label="Operational Command Bar">
      {/* Left: Active Mission Context & Route Title */}
      <div className="opbar-left">
        <div className="opbar-mission-chip" title="Current Active Mission / Expedition Scope">
          <span className="mission-prefix">EXPEDITION</span>
          <strong className="mission-code">
            {activeExpedition?.code || activeExpedition?.name || '44TH IAE'}
          </strong>
          {activeExpedition?.season && (
            <span className="mission-season">({activeExpedition.season})</span>
          )}
        </div>

        <div className="opbar-divider" aria-hidden="true" />

        {/* Compact Title / Route Indicator */}
        <div className="opbar-title-block">
          <span className="opbar-route-title">{title}</span>
          {subtitle && <span className="opbar-route-sub">{subtitle}</span>}
        </div>

        <div className="opbar-divider" aria-hidden="true" />

        {/* Compact KPI Chips */}
        <div className="opbar-kpis">
          <button
            type="button"
            className="opbar-kpi-chip"
            onClick={() => onNavigate('expeditions')}
            title="Active expeditions count"
          >
            <span className="kpi-num">{apiData.expeditions.length}</span>
            <span className="kpi-label">Missions</span>
          </button>
          <button
            type="button"
            className="opbar-kpi-chip"
            onClick={() => onNavigate('transport')}
            title="Transport movements"
          >
            <span className="kpi-num">{activeTransportCount}</span>
            <span className="kpi-label">Transport</span>
          </button>
          <button
            type="button"
            className={`opbar-kpi-chip ${openIncidentsCount > 0 ? 'kpi-alert' : ''}`}
            onClick={() => onNavigate('incidents')}
            title="Open operational incidents"
          >
            <span className="kpi-num">{openIncidentsCount}</span>
            <span className="kpi-label">Incidents</span>
          </button>
          <button
            type="button"
            className="opbar-kpi-chip"
            onClick={() => onNavigate('bases')}
            title="Polar stations & bases"
          >
            <span className="kpi-num">{apiData.stations.length}</span>
            <span className="kpi-label">Bases</span>
          </button>
        </div>
      </div>

      {/* Center: Global Search */}
      <div className="opbar-center">
        <div className="global-search-wrap">
          <div className="search-input-shell">
            <Search size={14} className="search-icon" aria-hidden="true" />
            <input
              className="text-input global-search"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value)
                setSearchOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false)
                if (e.key === 'Enter' && results[0]) choose(results[0])
              }}
              placeholder="Search assets, cargo, personnel…"
              aria-label="Search operational records"
            />
          </div>
          {searchOpen && query && (
            <div className="global-search-results" role="listbox">
              {results.length ? (
                results.map((item, index) => (
                  <button
                    type="button"
                    role="option"
                    key={`${item.type}-${index}`}
                    onClick={() => choose(item)}
                  >
                    <small>{item.type}</small>
                    <span>{item.label}</span>
                  </button>
                ))
              ) : (
                <p>No matching operational records.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Operational Reference Clocks, Telemetry, Controls, User */}
      <div className="opbar-right">
        {/* Polar Clocks */}
        <div className="opbar-clocks-shell">
          <PolarClock />
        </div>

        <div className="opbar-divider" aria-hidden="true" />

        {/* Telemetry Status */}
        <div
          className="connection-summary"
          role="status"
          aria-label={`API connectivity: ${connectionLabel}`}
          title={`API Status: ${connectionLabel} · Refreshed ${lastRefreshLabel}`}
        >
          <StatusPill status={connectionLabel} />
        </div>

        {/* Demo Notifications Trigger */}
        <button
          type="button"
          className={`opbar-icon-btn ${unreadNotificationsCount > 0 ? 'has-notifications' : ''}`}
          aria-label={`Demo notifications, ${unreadNotificationsCount} unread`}
          title={`Demo notifications (${unreadNotificationsCount} unread)`}
          onClick={() => {
            demoOperationsStore.markNotificationsRead()
            onNavigate('demo-history')
          }}
        >
          <Bell size={15} />
          {unreadNotificationsCount > 0 && (
            <span className="opbar-btn-badge">{unreadNotificationsCount}</span>
          )}
        </button>

        {/* Refresh Control */}
        <button
          type="button"
          className={`opbar-icon-btn ${isRefreshing ? 'is-spinning' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh operational telemetry"
          title={`Refresh operational data (Last: ${lastRefreshLabel})`}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
        </button>

        {/* Theme Toggle (Dark & Light Glacier Mode) */}
        <button
          type="button"
          className={`opbar-theme-toggle ${theme === 'light' ? 'is-light' : 'is-dark'}`}
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Theme: currently ${theme.toUpperCase()} (Click to switch to ${theme === 'light' ? 'DARK' : 'LIGHT GLACIER'} mode)`}
        >
          {theme === 'light' ? <Sun size={13} className="theme-toggle-icon" /> : <Moon size={13} className="theme-toggle-icon" />}
          <span className="theme-toggle-label">{theme === 'light' ? 'LIGHT' : 'DARK'}</span>
        </button>

        <div className="opbar-divider" aria-hidden="true" />

        {/* Operator User Information */}
        <div className="opbar-user-chip" title={`${user.full_name || 'Operator'} · ${user.role || 'HQ'}`}>
          <div className="user-text">
            <strong>{recordLabel(user.full_name, user.employee_code || user.email, 'Operator')}</strong>
            <span>{recordLabel(user.role, null, 'HQ')}{user.scope ? ` · ${user.scope}` : ''}</span>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          className="opbar-icon-btn btn-opbar-logout"
          onClick={onLogout}
          aria-label="Sign out"
          title="Sign out of POLARIS-OS"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}

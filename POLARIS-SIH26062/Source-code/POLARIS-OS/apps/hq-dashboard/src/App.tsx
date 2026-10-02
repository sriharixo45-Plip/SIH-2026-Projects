import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { ApiError, apiGet, apiPatch, apiPost, getAuthToken, setAuthToken, setRefreshToken } from './services/api'
import type { CargoItem, Expedition, Incident, InventoryStock, ItemCatalog, Personnel, PersonnelAssignment, Recommendation, Station, TransportImpact, TransportLeg, WeatherEvent } from './types'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { ErrorBanner } from './components/common/ErrorBanner'
import { SkeletonLoader } from './components/common/SkeletonLoader'
import { ImpactModal } from './components/modals/ImpactModal'
import { CommandCenter } from './pages/CommandCenter'
import { ExpeditionsPage } from './pages/ExpeditionsPage'
import { TransportPage } from './pages/TransportPage'
import { CargoPage } from './pages/CargoPage'
import { InventoryPage } from './pages/InventoryPage'
import { PersonnelPage } from './pages/PersonnelPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { RecommendationsPage } from './pages/RecommendationsPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { SyncOperationsPage } from './pages/SyncOperationsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { UsersRolesPage } from './pages/UsersRolesPage'
import { SyncConflictsPage } from './pages/SyncConflictsPage'
import { AIOperationsPage, DemoBasesPage, DemoCargoPage, DemoHistoryPage, DemoOperationsPage, DemoPeopleSummary, IncidentSyncPanel } from './pages/DemoOperationsPages'
import { AntarcticMap } from './components/map/AntarcticMap'
import { redactDatabaseIds, stationLabelById } from './utils/display'

type AuthUser = { user_id: string; employee_code?: string | null; full_name?: string | null; email?: string | null; role?: string | null; scope?: string | null; station_code?: string | null; station_id?: string | null }
const routes = ['command-center', 'tracking', 'expeditions', 'demo-operations', 'bases', 'transport', 'demo-cargo', 'cargo', 'inventory', 'personnel', 'incidents', 'ai-operations', 'recommendations', 'approvals', 'sync', 'conflicts', 'demo-history', 'audit', 'users']
const titles: Record<string, [string, string]> = {
  'command-center': ['Command Center', 'Expedition operations overview'], tracking: ['Tracking', 'Ships, flights, cargo and route activity Â· demo movement is simulated'], expeditions: ['Expeditions', 'Mission status and planning'], 'demo-operations':['Operations','Mission execution, route, people and cargo Â· demo records'], bases:['Polar bases','NCPOR, Maitri, Bharati and Himadri Â· synthetic roster data'], transport: ['Transport', 'Movement and route operations'], 'demo-cargo':['Cargo Manifest','Air cargo, ship cargo and lifecycle Â· demo records'], cargo: ['Cargo', 'Manifest and traceability'], inventory: ['Inventory', 'Station supply levels'], personnel: ['Personnel', 'Roster and assignments'], incidents: ['Incidents', 'Operational incident log'], 'ai-operations':['AI Operations','Rule based readiness analysis and supervisor approval'], recommendations: ['Recommendations', 'Operational decision support'], approvals: ['Approvals', 'Formal decision records'], sync: ['Sync', 'Server-side field operation queue'], conflicts: ['Sync Conflicts', 'Inspect and resolve competing field changes'], 'demo-history':['Notifications & History','Events from local demonstration workflows'], audit: ['Audit', 'Canonical system activity'], users: ['Users & Roles', 'Accounts and authorization roles'],
}
function routeFromHash() { const value = window.location.hash.replace(/^#\/?/, ''); return routes.includes(value) ? value : 'command-center' }

export default function App() {
  const [activeRoute, setActiveRoute] = useState(routeFromHash)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.localStorage.getItem('polaris_theme') === 'dark' ? 'dark' : 'light')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [expeditions, setExpeditions] = useState<Expedition[]>([])
  const [transportLegs, setTransportLegs] = useState<TransportLeg[]>([])
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([])
  const [inventoryStocks, setInventoryStocks] = useState<InventoryStock[]>([])
  const [itemCatalog, setItemCatalog] = useState<ItemCatalog[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [assignments, setAssignments] = useState<PersonnelAssignment[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [weatherEvents, setWeatherEvents] = useState<WeatherEvent[]>([])
  const [moduleErrors, setModuleErrors] = useState<Record<string, string>>({})
  const [dataErrors, setDataErrors] = useState<Record<string, string>>({})
  const [moduleErrorDetails, setModuleErrorDetails] = useState<Record<string, { status?: number; endpoint?: string; requestId?: string; body?: string }>>({})
  const [connection, setConnection] = useState<'checking' | 'connected' | 'error'>('checking')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const [impact, setImpact] = useState<TransportImpact | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [cancelingLegId, setCancelingLegId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionErrorDetails, setActionErrorDetails] = useState<{ status?: number; endpoint?: string; requestId?: string; body?: string }>()
  const [actionMessage, setActionMessage] = useState('')

  const logout = useCallback(() => { void apiPost('/auth/logout').catch(() => undefined); setAuthToken(null); setRefreshToken(null); setUser(null); setPassword(''); setAuthError('') }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('polaris_theme', theme) }, [theme])
  useEffect(() => {
    const changed = () => setActiveRoute(routeFromHash())
    const unauthorized = () => { setUser(null); setAuthError('Your session expired or is no longer valid. Please sign in again.') }
    window.addEventListener('hashchange', changed)
    window.addEventListener('polaris:unauthorized', unauthorized)
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('polaris:unauthorized', unauthorized) }
  }, [])

  const acceptToken = useCallback(async (token: string, refresh: string) => {
    setAuthToken(token)
    setRefreshToken(refresh)
    const me = await apiGet<AuthUser>('/auth/me')
    if (!me?.user_id) throw new Error('The account response did not include an authenticated user.')
    setUser(me)
    setAuthError('')
  }, [])
  useEffect(() => {
    let mounted = true
    const check = async () => {
      if (!getAuthToken()) { setAuthLoading(false); return }
      try { const me = await apiGet<AuthUser>('/auth/me'); if (mounted && me?.user_id) setUser(me) }
      catch { setAuthToken(null) }
      finally { if (mounted) setAuthLoading(false) }
    }
    void check()
    return () => { mounted = false }
  }, [])

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault(); setLoginLoading(true); setAuthError('')
    try {
      const result = await apiPost<{ access_token: string; refresh_token: string }>('/auth/login', { identity: identity.trim(), password })
      if (!result?.access_token || !result?.refresh_token) throw new Error('The login response did not include a complete token pair.')
      await acceptToken(result.access_token, result.refresh_token)
    } catch (error) {
      setAuthToken(null)
      setAuthError(error instanceof ApiError && error.status === 401 ? 'Sign-in failed. Check your email or employee ID and password.' : error instanceof Error ? error.message : 'Unable to sign in.')
    } finally { setLoginLoading(false); setAuthLoading(false) }
  }

  const loadAllData = useCallback(async (full = false) => {
    if (!user) return
    if (full) setLoading(true)
    else setRefreshing(true)
    setModuleErrors({})
    setDataErrors({})
    setModuleErrorDetails({})
    const requests = [
      ['command-center', '/stations', setStations], ['expeditions', '/expeditions', setExpeditions], ['transport', '/transport-legs', setTransportLegs], ['cargo', '/cargo-items', setCargoItems], ['inventory', '/inventory-stocks', setInventoryStocks], ['inventory', '/item-catalog', setItemCatalog], ['personnel', '/personnel', setPersonnel], ['personnel', '/personnel-assignments', setAssignments], ['incidents', '/incidents', setIncidents], ['recommendations', '/recommendations', setRecommendations], ['command-center', '/weather-events', setWeatherEvents],
    ] as const
    const results = await Promise.allSettled(requests.map(([, path]) => apiGet<unknown>(path)))
    const errors: Record<string, string> = {}
    const endpointErrors: Record<string, string> = {}
    const details: Record<string, { status?: number; endpoint?: string; requestId?: string; body?: string }> = {}
    let anySuccess = false
    results.forEach((result, index) => {
      const [module, , setter] = requests[index]
      if (result.status === 'fulfilled' && Array.isArray(result.value)) { anySuccess = true; setter(result.value as never) }
      else if (result.status === 'fulfilled') { anySuccess = true; setter([]); endpointErrors[requests[index][1]] = 'The API returned an unexpected data format.'; errors[module] = errors[module] ?? endpointErrors[requests[index][1]] }
      else {
        setter([])
        endpointErrors[requests[index][1]] = result.reason instanceof Error ? result.reason.message : 'Request failed.'
        errors[module] = errors[module] ?? endpointErrors[requests[index][1]]
        if (result.reason instanceof ApiError && !details[module]) details[module] = { status: result.reason.status, endpoint: result.reason.endpoint, requestId: result.reason.requestId, body: result.reason.technicalDetails }
      }
    })
    setModuleErrors(errors)
    setDataErrors(endpointErrors)
    setModuleErrorDetails(details)
    const apiResponded = results.some((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status > 0)
    setConnection(anySuccess || apiResponded ? 'connected' : 'error')
    setLastRefresh(new Date().toISOString())
    setLoading(false); setRefreshing(false)
  }, [user])

  useEffect(() => { if (user) void loadAllData(true) }, [user, loadAllData])
  useEffect(() => {
    const refresh = () => { void loadAllData() }
    window.addEventListener('polaris:refresh', refresh)
    return () => window.removeEventListener('polaris:refresh', refresh)
  }, [loadAllData])

  const navigateTo = (route: string) => { const safe = routes.includes(route) ? route : 'command-center'; setActiveRoute(safe); window.location.hash = `/${safe}` }
  const closeImpact = useCallback(() => setImpact(null), [])
  const handleCancelLeg = async (legId: string) => {
    setCancelingLegId(legId); setActionError(''); setActionErrorDetails(undefined); setActionMessage('Cancellation request pendingâ€¦')
    try {
      await apiPatch(`/transport-legs/${legId}/status`, { status: 'cancelled' })
      setActionMessage('Cancellation completed. Refreshing transport data and requesting impact analysis.')
      await loadAllData()
      try { setImpact(await apiGet<TransportImpact>(`/transport-legs/${legId}/impact`)) }
      catch (error) { setActionError(`Cancellation completed, but impact analysis is unavailable: ${error instanceof Error ? error.message : 'request failed'}`); if (error instanceof ApiError) setActionErrorDetails({ status: error.status, endpoint: error.endpoint, requestId: error.requestId, body: error.technicalDetails }) }
    }
    catch (error) { setActionMessage(''); setActionError(error instanceof Error ? error.message : 'Cancellation failed.'); if (error instanceof ApiError) setActionErrorDetails({ status: error.status, endpoint: error.endpoint, requestId: error.requestId, body: error.technicalDetails }) }
    finally { setCancelingLegId(null) }
  }
  const handleImpactView = async (legId: string) => {
    setImpactLoading(true); setActionError(''); setActionErrorDetails(undefined)
    try { setImpact(await apiGet<TransportImpact>(`/transport-legs/${legId}/impact`)) }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Impact analysis unavailable.'); if (error instanceof ApiError) setActionErrorDetails({ status: error.status, endpoint: error.endpoint, requestId: error.requestId, body: error.technicalDetails }) }
    finally { setImpactLoading(false) }
  }
  const openIncidentsCount = useMemo(() => incidents.filter((i) => !['resolved', 'closed'].includes((i.status ?? '').toLowerCase())).length, [incidents])
  const [title, subtitle] = titles[activeRoute] ?? titles['command-center']

  if (authLoading) return <main className="auth-screen"><p role="status">Checking your sessionâ€¦</p></main>
  if (!user) return <main className="auth-screen"><form className="login-panel" onSubmit={handleLogin}>
    <p className="eyebrow">POLARIS-OS Â· HEADQUARTERS</p><h1>Sign in</h1><p className="muted-text">Use your registered account to access expedition operations.</p>
    {authError && <div className="error-banner" role="alert">{authError}</div>}
    <label htmlFor="identity">Email or employee ID</label><input id="identity" className="text-input" autoComplete="username" value={identity} onChange={(event) => setIdentity(event.target.value)} required />
    <label htmlFor="password">Password</label><input id="password" className="text-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
    <button className="btn-primary" type="submit" disabled={loginLoading}>{loginLoading ? 'Signing inâ€¦' : 'Sign in'}</button>
    <p className="form-note">Access and station scope come from your authenticated account. UI visibility does not replace server authorization.</p>
  </form></main>

  const stationScope = (user.scope ? redactDatabaseIds(user.scope) : null) || (user.station_id
    ? stationLabelById(user.station_id, stations)
    : user.station_code
      ? stations.find((station) => station.code === user.station_code)
        ? stationLabelById(stations.find((station) => station.code === user.station_code)?.station_id, stations)
        : null
      : /hq|headquarters|administrator/i.test(user.role || '') ? 'Global HQ' : null)

  return <div className="app-shell">
    <Sidebar activeRoute={activeRoute} onNavigate={navigateTo} incidentCount={openIncidentsCount} />
    <main className="main-content">
      <Topbar title={title} subtitle={subtitle} connection={connection} lastRefresh={lastRefresh} isRefreshing={refreshing} user={{ ...user, scope: stationScope }} onRefresh={() => void loadAllData()} onLogout={logout} theme={theme} onToggleTheme={() => setTheme((old) => old === 'light' ? 'dark' : 'light')} onNavigate={navigateTo} apiData={{stations,expeditions,cargoItems,personnel,incidents,transportLegs}} />
      <div className="demo-banner"><strong>DEMO ENVIRONMENT</strong><span>Synthetic demonstration data â€” not operational NCPOR data.</span></div>
      {moduleErrors[activeRoute] && <ErrorBanner message={moduleErrors[activeRoute]} details={moduleErrorDetails[activeRoute]} onRetry={() => void loadAllData()} />}
      {actionError && <ErrorBanner message={actionError} details={actionErrorDetails} onRetry={() => activeRoute === 'transport' ? void loadAllData() : undefined} />}
      {actionMessage && <div className="notice-banner" role="status">{actionMessage}</div>}
      {loading ? <div className="page-container"><SkeletonLoader rows={6} height="32px" /></div> : <>
        {activeRoute === 'command-center' && <CommandCenter stations={stations} stationsError={dataErrors['/stations']} weatherError={dataErrors['/weather-events']} personnelError={dataErrors['/personnel']} assignmentsError={dataErrors['/personnel-assignments']} expeditions={expeditions} transportLegs={transportLegs} cargoItems={cargoItems} inventoryStocks={inventoryStocks} personnel={personnel} assignments={assignments} incidents={incidents} recommendations={recommendations} weatherEvents={weatherEvents} moduleErrors={moduleErrors} onViewImpact={handleImpactView} onNavigate={navigateTo} impactLoading={impactLoading} refreshMarker={lastRefresh} />}
        {activeRoute === 'tracking' && <div className="page-container"><div className="demo-module-banner">DEMO / SIMULATED asset tracks move locally along planned routes. AIS data, when configured, is labeled separately.</div><section className="panel map-panel"><div className="panel-header"><div><p className="eyebrow">UNIFIED MOVEMENT MAP</p><h2>Polar network Â· operational view</h2></div></div><div className="map-body"><AntarcticMap stations={stations} transportLegs={transportLegs} incidents={incidents.filter(i=>!['resolved','closed'].includes((i.status||'').toLowerCase()))} onNavigate={navigateTo} /></div></section></div>}
        {activeRoute === 'expeditions' && <ExpeditionsPage expeditions={expeditions} dataError={dataErrors['/expeditions']} />}
        {activeRoute === 'demo-operations' && <DemoOperationsPage onNavigate={navigateTo} actor={user.full_name||user.employee_code||'Authenticated operator'} />}
        {activeRoute === 'bases' && <DemoBasesPage onNavigate={navigateTo} />}
        {activeRoute === 'transport' && <TransportPage transportLegs={transportLegs} dataError={dataErrors['/transport-legs']} cargoItems={cargoItems} personnel={personnel} assignments={assignments} stations={stations} onCancelLeg={handleCancelLeg} onViewImpact={handleImpactView} cancelingLegId={cancelingLegId} impactLoading={impactLoading} />}
        {activeRoute === 'cargo' && <CargoPage cargoItems={cargoItems} dataError={dataErrors['/cargo-items']} transportLegs={transportLegs} />}
        {activeRoute === 'demo-cargo' && <DemoCargoPage onNavigate={navigateTo} />}
        {activeRoute === 'inventory' && <InventoryPage inventoryStocks={inventoryStocks} dataError={dataErrors['/inventory-stocks']} catalogError={dataErrors['/item-catalog']} stations={stations} itemCatalog={itemCatalog} />}
        {activeRoute === 'personnel' && <><div className="page-container"><DemoPeopleSummary actor={user.full_name||user.employee_code||'Authenticated user'} role={user.role} /></div><PersonnelPage personnel={personnel} personnelError={dataErrors['/personnel']} assignmentsError={dataErrors['/personnel-assignments']} assignments={assignments} stations={stations} expeditions={expeditions} transportLegs={transportLegs} /></>}
        {activeRoute === 'incidents' && <><div className="page-container"><IncidentSyncPanel /></div><IncidentsPage incidents={incidents} dataError={dataErrors['/incidents']} stations={stations} transportLegs={transportLegs} personnel={personnel} onRefresh={() => void loadAllData()} currentUserId={user.user_id} /></>}
        {activeRoute === 'recommendations' && <RecommendationsPage recommendations={recommendations} dataError={dataErrors['/recommendations']} onNavigate={navigateTo} />}
        {activeRoute === 'ai-operations' && <AIOperationsPage actor={user.full_name||user.employee_code||'Authenticated supervisor'} role={user.role} />}
        {activeRoute === 'approvals' && <ApprovalsPage onRefresh={() => void loadAllData()} currentUserId={user.user_id} currentRole={user.role} />}
        {activeRoute === 'sync' && <SyncOperationsPage />}{activeRoute === 'conflicts' && <SyncConflictsPage />}{activeRoute === 'demo-history' && <DemoHistoryPage />}{activeRoute === 'audit' && <><DemoHistoryPage /><AuditLogPage /></>}{activeRoute === 'users' && <UsersRolesPage />}
      </>}
    </main>
    <ImpactModal impact={impact} stations={stations} onClose={closeImpact} />
  </div>
}

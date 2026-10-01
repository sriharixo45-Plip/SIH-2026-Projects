import { PolarClock } from '../common/PolarClock'
import { StatusPill } from '../common/StatusPill'
import { recordLabel } from '../../utils/display'

type UserSummary = { full_name?: string | null; email?: string | null; employee_code?: string | null; role?: string | null; scope?: string | null }
type TopbarProps = { title: string; subtitle: string; connection: 'checking' | 'connected' | 'error'; lastRefresh: string | null; onRefresh: () => void; isRefreshing: boolean; user: UserSummary; onLogout: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }

export function Topbar({ title, subtitle, connection, lastRefresh, onRefresh, isRefreshing, user, onLogout, theme, onToggleTheme }: TopbarProps) {
  const connectionLabel = connection === 'connected' ? 'Connected' : connection === 'error' ? 'Offline' : 'Checking'
  const lastRefreshLabel = lastRefresh
    ? `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(lastRefresh))} IST`
    : 'Not yet refreshed'
  return <header className="topbar">
    <div className="page-heading"><p className="eyebrow">HQ OPERATIONS</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>
    <div className="topbar-tools">
      <PolarClock />
      <div className="connection-summary" role="status" aria-label={`API connectivity: ${connectionLabel}`}><span>API connectivity</span><StatusPill status={connectionLabel} /></div>
      <div className="refresh-meta"><span>Last refresh</span><strong>{lastRefreshLabel}</strong></div>
      <button type="button" className="btn-secondary" onClick={onRefresh} disabled={isRefreshing}>{isRefreshing ? 'Refreshing…' : 'Refresh data'}</button>
      <button type="button" className="btn-secondary" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
      <div className="user-summary"><strong>{recordLabel(user.full_name, user.employee_code || user.email, 'Authenticated user')}</strong><span>{recordLabel(user.role, null, 'Role unavailable')}{user.scope ? ` · ${user.scope}` : ''}</span></div>
      <button type="button" className="btn-logout" onClick={onLogout}>Sign out</button>
    </div>
  </header>
}

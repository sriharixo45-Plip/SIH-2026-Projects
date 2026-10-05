import type { ComponentType } from 'react'
import {
  LayoutDashboard,
  Compass,
  Flag,
  Activity,
  Building2,
  Truck,
  ClipboardList,
  Package,
  Boxes,
  Archive,
  Users,
  AlertTriangle,
  Cpu,
  FileText,
  CheckSquare,
  Sliders,
  RefreshCw,
  GitMerge,
  Bell,
  ShieldCheck,
  UserCog,
  LogOut,
  Radio,
} from 'lucide-react'

type UserSummary = {
  full_name?: string | null
  email?: string | null
  employee_code?: string | null
  role?: string | null
  scope?: string | null
}

type SidebarProps = {
  activeRoute: string
  onNavigate: (route: string) => void
  incidentCount?: number
  pendingApprovalCount?: number
  user?: UserSummary | null
  onLogout?: () => void
}

type NavItemConfig = {
  id: string
  label: string
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}

type NavGroupConfig = {
  key: string
  label: string
  items: NavItemConfig[]
}

const navGroups: NavGroupConfig[] = [
  {
    key: 'command',
    label: 'COMMAND',
    items: [
      { id: 'command-center', label: 'Command Center', icon: LayoutDashboard },
      { id: 'tracking', label: 'Tracking', icon: Compass },
    ],
  },
  {
    key: 'operations',
    label: 'OPERATIONS',
    items: [
      { id: 'expeditions', label: 'Expeditions', icon: Flag },
      { id: 'demo-operations', label: 'Operations', icon: Activity },
      { id: 'bases', label: 'Polar Bases', icon: Building2 },
      { id: 'transport', label: 'Transport', icon: Truck },
    ],
  },
  {
    key: 'logistics',
    label: 'LOGISTICS',
    items: [
      { id: 'cargo-manifest', label: 'Cargo Manifest', icon: ClipboardList },
      { id: 'cargo', label: 'Cargo Records', icon: Package },
      { id: 'demo-cargo', label: 'Local Cargo Demo', icon: Boxes },
      { id: 'inventory', label: 'Inventory', icon: Archive },
      { id: 'personnel', label: 'Personnel', icon: Users },
    ],
  },
  {
    key: 'response',
    label: 'RESPONSE',
    items: [
      { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
      { id: 'ai-operations', label: 'Decision Support', icon: Cpu },
      { id: 'recommendations', label: 'Recommendations', icon: FileText },
      { id: 'approvals', label: 'Approvals', icon: CheckSquare },
      { id: 'decision-support-demo', label: 'Local Rule Engine Demo', icon: Sliders },
    ],
  },
  {
    key: 'synchronization',
    label: 'SYNCHRONIZATION',
    items: [
      { id: 'sync', label: 'Sync Queue', icon: RefreshCw },
      { id: 'conflicts', label: 'Sync Conflicts', icon: GitMerge },
      { id: 'demo-history', label: 'Notifications & History', icon: Bell },
    ],
  },
  {
    key: 'governance',
    label: 'GOVERNANCE',
    items: [
      { id: 'audit', label: 'Audit Log', icon: ShieldCheck },
    ],
  },
  {
    key: 'administration',
    label: 'ADMINISTRATION',
    items: [
      { id: 'users', label: 'Users & Roles', icon: UserCog },
    ],
  },
]

export function Sidebar({
  activeRoute,
  onNavigate,
  incidentCount = 0,
  pendingApprovalCount = 0,
  user,
  onLogout,
}: SidebarProps) {
  const userInitials = (user?.full_name || user?.employee_code || user?.email || 'HQ')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="polar-nav sidebar" aria-label="Command Navigation Rail">
      {/* Brand Icon Header */}
      <div className="polar-rail-brand">
        <button
          type="button"
          className="polar-rail-mark-btn"
          onClick={() => onNavigate('command-center')}
          aria-label="POLARIS-OS Command Center Home"
          title="POLARIS-OS Expedition HQ"
        >
          <span className="brand-mark" aria-hidden="true">
            <Radio size={18} />
          </span>
        </button>
      </div>

      {/* 60px Scrollable Icon Rail */}
      <nav className="polar-rail-items" aria-label="Operational Navigation">
        {navGroups.map((group, groupIndex) => (
          <div className="polar-rail-group" key={group.key}>
            {groupIndex > 0 && (
              <div
                className="polar-rail-divider"
                role="separator"
                aria-label={group.label}
                title={group.label}
              />
            )}
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = activeRoute === item.id
              const isIncident = item.id === 'incidents' && incidentCount > 0
              const isApproval = item.id === 'approvals' && pendingApprovalCount > 0

              return (
                <div className="polar-rail-item-wrap" key={item.id}>
                  <button
                    type="button"
                    className={`polar-rail-btn ${isActive ? 'active' : ''}`}
                    onClick={() => onNavigate(item.id)}
                    aria-label={`${item.label} · ${group.label}`}
                    aria-current={isActive ? 'page' : undefined}
                    title={`${item.label} (${group.label})`}
                  >
                    <Icon size={18} aria-hidden={true} className="polar-rail-icon" />

                    {/* Alert / Attention Badges */}
                    {isIncident && (
                      <span
                        className="polar-rail-badge alert"
                        aria-label={`${incidentCount} open incidents`}
                      >
                        {incidentCount > 99 ? '99+' : incidentCount}
                      </span>
                    )}
                    {isApproval && (
                      <span
                        className="polar-rail-badge warning"
                        aria-label={`${pendingApprovalCount} pending approvals`}
                      >
                        {pendingApprovalCount}
                      </span>
                    )}

                    {/* Hover / Focus Flyout Tooltip */}
                    <div className="polar-rail-tooltip" role="tooltip">
                      <span className="tooltip-group">{group.label}</span>
                      <strong className="tooltip-title">{item.label}</strong>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Rail Bottom: Operator Info & Sign out */}
      <div className="polar-rail-footer">
        {user && (
          <div className="polar-rail-user-wrap">
            <div
              className="polar-rail-avatar"
              aria-label={`Operator: ${user.full_name || user.email || 'HQ'}`}
              title={`${user.full_name || 'Operator'} (${user.role || 'HQ'})`}
            >
              {userInitials}
              <div className="polar-rail-tooltip" role="tooltip">
                <span className="tooltip-group">OPERATOR</span>
                <strong className="tooltip-title">{user.full_name || user.employee_code || 'Operator'}</strong>
                <span className="tooltip-sub">{user.role || 'HQ'}{user.scope ? ` · ${user.scope}` : ''}</span>
              </div>
            </div>
          </div>
        )}

        {onLogout && (
          <div className="polar-rail-item-wrap">
            <button
              type="button"
              className="polar-rail-btn btn-rail-logout"
              onClick={onLogout}
              aria-label="Sign out of POLARIS-OS HQ"
              title="Sign out"
            >
              <LogOut size={16} aria-hidden={true} />
              <div className="polar-rail-tooltip" role="tooltip">
                <strong className="tooltip-title">Sign out</strong>
              </div>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

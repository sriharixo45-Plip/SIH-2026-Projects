type SidebarProps = { activeRoute: string; onNavigate: (route: string) => void; incidentCount?: number; pendingApprovalCount?: number }
const sections: [string, [string, string][]][] = [
  ['COMMAND', [['command-center', 'Command Center'], ['tracking', 'Tracking map'], ['expeditions', 'Expeditions'], ['demo-operations', 'Operations'], ['bases', 'Polar bases'], ['transport', 'Transport']]],
  ['LOGISTICS', [['demo-cargo', 'Cargo manifest'], ['cargo', 'Cargo records'], ['inventory', 'Inventory'], ['personnel', 'Personnel']]],
  ['RESPONSE', [['incidents', 'Incidents'], ['ai-operations', 'AI Operations'], ['recommendations', 'Recommendations'], ['approvals', 'Approvals']]],
  ['SYNCHRONIZATION', [['sync', 'Sync'], ['conflicts', 'Conflicts'], ['demo-history', 'Notifications & history'], ['audit', 'Audit']]],
  ['ADMINISTRATION', [['users', 'Users & Roles']]],
]
export function Sidebar({ activeRoute, onNavigate, incidentCount = 0, pendingApprovalCount = 0 }: SidebarProps) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><div><div className="brand-name">POLARIS-OS</div><div className="brand-subtitle">EXPEDITION LOGISTICS</div></div></div>
    <nav className="navigation" aria-label="Operational modules">{sections.map(([section, modules]) => <div className="nav-section" key={section}><span className="nav-section-label">{section}</span>{modules.map(([id, label]) => <button key={id} type="button" aria-current={activeRoute === id ? 'page' : undefined} className={`nav-item ${activeRoute === id ? 'active' : ''}`} onClick={() => onNavigate(id)}>
      <span className="nav-label">{label}</span>{id === 'incidents' && incidentCount > 0 && <span className="nav-badge" aria-label={`${incidentCount} open incidents`}>{incidentCount}</span>}{id === 'approvals' && pendingApprovalCount > 0 && <span className="nav-badge">{pendingApprovalCount}</span>}
    </button>)}</div>)}</nav>
    <div className="sidebar-footer">Headquarters operations</div>
  </aside>
}

import { useEffect, useMemo, useState } from 'react'

type SidebarProps = { activeRoute: string; onNavigate: (route: string) => void; incidentCount?: number; pendingApprovalCount?: number }
type NavGroup = { label: string; routes: [string, string][] }

const sections: NavGroup[] = [
  { label: 'COMMAND', routes: [['command-center', 'Command Center'], ['tracking', 'Tracking']] },
  { label: 'OPERATIONS', routes: [['expeditions', 'Expeditions'], ['demo-operations', 'Operations'], ['bases', 'Polar bases'], ['transport', 'Transport']] },
  { label: 'LOGISTICS', routes: [['demo-cargo', 'Cargo manifest · DEMO'], ['cargo', 'Cargo'], ['inventory', 'Inventory'], ['personnel', 'Personnel']] },
  { label: 'RESPONSE', routes: [['incidents', 'Incidents'], ['ai-operations', 'Decision Support'], ['recommendations', 'Recommendations'], ['approvals', 'Approvals']] },
  { label: 'SYNCHRONIZATION', routes: [['sync', 'Sync'], ['conflicts', 'Conflicts'], ['demo-history', 'Notifications & history · DEMO']] },
  { label: 'GOVERNANCE', routes: [['audit', 'Audit']] },
  { label: 'ADMINISTRATION', routes: [['users', 'Users & Roles']] },
]

export function Sidebar({ activeRoute, onNavigate, incidentCount = 0, pendingApprovalCount = 0 }: SidebarProps) {
  const activeSection = useMemo(() => sections.findIndex((section) => section.routes.some(([id]) => id === activeRoute)), [activeRoute])
  const [expanded, setExpanded] = useState<number[]>(() => [0, activeSection].filter((value, index, all) => value >= 0 && all.indexOf(value) === index))
  useEffect(() => setExpanded([0, activeSection].filter((value, index, all) => value >= 0 && all.indexOf(value) === index)), [activeSection])

  const navigate = (route: string, sectionIndex: number) => {
    setExpanded(sectionIndex === 0 ? [0] : [0, sectionIndex])
    onNavigate(route)
  }

  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><div><div className="brand-name">POLARIS-OS</div><div className="brand-subtitle">EXPEDITION LOGISTICS</div></div></div>
    <nav className="navigation" aria-label="Operational modules">{sections.map((section, sectionIndex) => {
      const isExpanded = expanded.includes(sectionIndex)
      const sectionId = `nav-section-${section.label.toLowerCase()}`
      const containsActive = section.routes.some(([id]) => activeRoute === id)
      return <section className={`nav-section ${containsActive ? 'contains-active' : ''}`} key={section.label}>
        <button type="button" className="nav-section-toggle" aria-expanded={isExpanded} aria-controls={sectionId} onClick={() => { if (isExpanded && containsActive) return; setExpanded((current) => isExpanded ? current.filter((item) => item !== sectionIndex) : [...current, sectionIndex]) }}>
          <span>{section.label}</span><span className="nav-section-state" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
        </button>
        {isExpanded && <div className="nav-section-items" id={sectionId}>{section.routes.map(([id, label]) => <button key={id} type="button" aria-current={activeRoute === id ? 'page' : undefined} className={`nav-item ${activeRoute === id ? 'active' : ''}`} onClick={() => navigate(id, sectionIndex)}>
          <span className="nav-label">{label}</span>{id === 'incidents' && incidentCount > 0 && <span className="nav-badge" aria-label={`${incidentCount} open incidents`}>{incidentCount}</span>}{id === 'approvals' && pendingApprovalCount > 0 && <span className="nav-badge">{pendingApprovalCount}</span>}
        </button>)}</div>}
      </section>
    })}</nav>
    <div className="sidebar-footer">Headquarters operations</div>
  </aside>
}

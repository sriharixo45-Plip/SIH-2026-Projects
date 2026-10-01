type StatusPillProps = {
  status?: string | null
  tone?: 'normal' | 'active' | 'planned' | 'warning' | 'danger' | 'success' | 'neutral'
}

export function formatStatusLabel(value?: string | null): string {
  if (!value) return 'Unknown'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return `Record · …${value.slice(-8)}`
  const normalized = value.toLowerCase().replace(/[ _-]+/g, ' ').trim()
  const labels: Record<string, string> = {
    synced: 'Synced', pending: 'Pending', failed: 'Failed', rejected: 'Rejected',
    conflicted: 'Conflict', conflict: 'Conflict', unresolved: 'Conflict',
    resolved: 'Resolved', generated: 'Generated', critical: 'Critical',
    declared: 'Declared', offline: 'Offline', connected: 'Connected',
  }
  if (labels[normalized]) return labels[normalized]
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function getToneFromStatus(status?: string | null): 'normal' | 'active' | 'planned' | 'warning' | 'danger' | 'success' | 'neutral' {
  if (!status) return 'neutral'
  const normalized = status.toLowerCase().replace(/\s+/g, '_')
  if (['cancelled', 'canceled', 'critical', 'failed', 'out_of_stock', 'rejected', 'conflicted', 'conflict', 'emergency'].includes(normalized)) return 'danger'
  if (['warning', 'delayed', 'low', 'pending', 'declared', 'reopened', 'resource_requested', 'offline'].includes(normalized)) return 'warning'
  if (['operational', 'completed', 'active', 'in_transit', 'approved', 'synced', 'resolved', 'connected', 'available', 'normal'].includes(normalized)) return 'success'
  if (['planned', 'in_review', 'generated'].includes(normalized)) return 'planned'
  return 'neutral'
}

export function StatusPill({ status, tone }: StatusPillProps) {
  const effectiveTone = tone ?? getToneFromStatus(status)
  return (
    <span className={`status-pill tone-${effectiveTone}`}>
      <span className="pill-dot" />
      {formatStatusLabel(status)}
    </span>
  )
}

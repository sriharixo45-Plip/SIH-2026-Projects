type EmptyStateProps = {
  title?: string
  message: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
}

export function EmptyState({ title, message, actionLabel, onAction, compact = false }: EmptyStateProps) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      {title ? <strong className="empty-title">{title}</strong> : null}
      <p className="empty-message">{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

type RecordReferenceProps = { label?: string | null; title?: string }

export function RecordReference({ label, title }: RecordReferenceProps) {
  const text = label?.trim() || 'Record details unavailable'
  return <span className="record-reference" title={title || text}>{text}</span>
}

import { formatDateTime } from '../../utils/display'

type TimestampProps = { value?: string | null; compact?: boolean }

export function Timestamp({ value, compact = false }: TimestampProps) {
  if (!value || Number.isNaN(Date.parse(value))) return <span>Not provided</span>
  const full = formatDateTime(value)
  return <time dateTime={value} title={full}>{formatDateTime(value, compact)}</time>
}
